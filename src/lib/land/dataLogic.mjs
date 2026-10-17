const KHATA_PATCH_FIELDS = new Set([
  'mouza_od', 'mouza_en', 'tehsil_od', 'tehsil_no', 'police_station_od',
  'police_station_no', 'district_od', 'recorded_holders_od', 'tenure_od',
  'special_remarks_od', 'final_publication_date', 'revenue_assessment_date',
]);

const PLOT_PATCH_FIELDS = new Set([
  'plot_no', 'land_class_od', 'area_acres', 'local_name_od', 'boundaries_od',
  'remarks_od', 'area_hectares_on_pdf',
]);

const clone = (value) => structuredClone(value);
const makeKhataKey = (khata) => [
  khata.district_od,
  khata.tehsil_od,
  khata.mouza_od,
  String(khata.khata_no),
].join('|');

const makePlotKey = (khata, plot) => `${makeKhataKey(khata)}|${String(plot.plot_no)}`;

const recalculateKhata = (khata) => {
  khata.plot_count = khata.plots.length;
  khata.total_acres = khata.plots.reduce((sum, plot) => sum + Number(plot.area_acres || 0), 0);
  khata.total_sqft = khata.total_acres * 43560;
  khata.total_sqm = khata.total_acres * 4046.8564224;
  khata.total_hectares_calc = khata.total_acres * 0.40468564224;
  return khata;
};

export const validateLandRevisionInput = (candidate) => {
  const changeType = candidate?.change_type;
  if (!['correct', 'add', 'archive'].includes(changeType)) {
    return { ok: false, error: 'Choose correction, addition, or archive.' };
  }
  if (typeof candidate?.business_key !== 'string' || candidate.business_key.length < 3) {
    return { ok: false, error: 'A valid record key is required.' };
  }
  if (typeof candidate?.reason !== 'string' || candidate.reason.trim().length < 8) {
    return { ok: false, error: 'Explain the reason in at least 8 characters.' };
  }
  if (typeof candidate?.source_reference !== 'string' || candidate.source_reference.trim().length < 4) {
    return { ok: false, error: 'Add the source document and page.' };
  }
  if (changeType === 'correct') {
    const { scope, field } = candidate.patch || {};
    const allowed = scope === 'khata' ? KHATA_PATCH_FIELDS : scope === 'plot' ? PLOT_PATCH_FIELDS : null;
    if (!allowed?.has(field)) return { ok: false, error: 'That field cannot be corrected here.' };
    if (!Object.hasOwn(candidate.patch, 'value')) return { ok: false, error: 'A revised value is required.' };
  }
  if (changeType === 'add') {
    const { khata, plot } = candidate.patch || {};
    if (!khata?.khata_no || !khata?.district_od || !khata?.tehsil_od || !khata?.mouza_od) {
      return { ok: false, error: 'The new record needs district, tehsil, mouza, and khata.' };
    }
    if (!plot?.plot_no || !plot?.land_class_od || !Number.isFinite(Number(plot?.area_acres))) {
      return { ok: false, error: 'The new record needs plot number, land class, and numeric acres.' };
    }
  }
  return { ok: true };
};

export const buildLandBundle = ({ khatas, documents, people, revisions = [] }) => {
  const working = clone(khatas).map((khata) => {
    const document = documents.find((item) => item.khata_no === String(khata.khata_no));
    const khataKey = makeKhataKey(khata);
    return recalculateKhata({
      ...khata,
      id: khataKey,
      source: document || null,
      review_state: khata.issues?.length ? 'needs_review' : 'source_verified',
      geometry_status: 'unknown',
      plots: khata.plots.map((plot) => ({
        ...plot,
        id: makePlotKey(khata, plot),
        business_key: makePlotKey(khata, plot),
        geometry_status: 'unknown',
        source_reference: `Odisha Bhulekh PDF, page ${plot.source_page || 2}`,
      })),
      revision_count: 0,
    });
  });

  const history = [];
  for (const revision of [...revisions].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    const validation = validateLandRevisionInput(revision);
    if (!validation.ok) continue;
    history.push(revision);
    if (revision.change_type === 'add') {
      const nextKhata = clone(revision.patch.khata);
      const existing = working.find((item) => makeKhataKey(item) === makeKhataKey(nextKhata));
      const nextPlot = clone(revision.patch.plot);
      if (existing) {
        if (!existing.plots.some((plot) => plot.business_key === revision.business_key)) {
          existing.plots.push({
            ...nextPlot,
            id: revision.business_key,
            business_key: revision.business_key,
            geometry_status: 'unknown',
            source_reference: revision.source_reference,
            revision_id: revision.id,
          });
          existing.revision_count += 1;
          recalculateKhata(existing);
        }
      } else {
        const added = {
          ...nextKhata,
          id: makeKhataKey(nextKhata),
          source: null,
          issues: ['Added through the reviewed family register workflow; original government PDF must be retained separately.'],
          review_state: 'admin_reviewed_addition',
          geometry_status: 'unknown',
          revision_count: 1,
          plots: [{
            ...nextPlot,
            id: revision.business_key,
            business_key: revision.business_key,
            geometry_status: 'unknown',
            source_reference: revision.source_reference,
            revision_id: revision.id,
          }],
        };
        working.push(recalculateKhata(added));
      }
      continue;
    }

    const khata = working.find((item) => item.plots.some((plot) => plot.business_key === revision.business_key));
    if (!khata) continue;
    const plot = khata.plots.find((item) => item.business_key === revision.business_key);
    if (revision.change_type === 'archive' && plot) {
      khata.plots = khata.plots.filter((item) => item.business_key !== revision.business_key);
      khata.revision_count += 1;
      recalculateKhata(khata);
      continue;
    }
    if (revision.change_type === 'correct') {
      const target = revision.patch.scope === 'khata' ? khata : plot;
      if (!target) continue;
      target[revision.patch.field] = revision.patch.value;
      target.revision_id = revision.id;
      target.source_reference = revision.source_reference;
      khata.revision_count += 1;
      recalculateKhata(khata);
    }
  }

  const visibleKhatas = working.filter((khata) => khata.plots.length > 0);
  return {
    khatas: visibleKhatas,
    people: people.people || [],
    person_review_queue: people.review_queue || [],
    history,
    summary: {
      khatas: visibleKhatas.length,
      plots: visibleKhatas.reduce((sum, khata) => sum + khata.plots.length, 0),
      total_acres: visibleKhatas.reduce((sum, khata) => sum + khata.total_acres, 0),
    },
  };
};

export const landBusinessKey = { makeKhataKey, makePlotKey };

