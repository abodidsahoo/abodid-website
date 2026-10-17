import { useEffect, useMemo, useRef, useState } from 'react';

type Language = 'or' | 'en';
type View = 'home' | 'khatas' | 'people' | 'maps' | 'detail' | 'person';
type FontScale = 'normal' | 'large' | 'xlarge';
type ColumnKey = 'plot' | 'kisam' | 'local' | 'area' | 'action';

type Plot = {
  id: string;
  business_key: string;
  plot_no: string;
  land_class_od: string;
  area_acres: number;
  area_sqft: number;
  area_sqm: number;
  area_hectares_calc: number;
  area_hectares_on_pdf?: number | null;
  local_name_od?: string;
  boundaries_od?: string;
  remarks_od?: string;
  source_reference: string;
};

type Khata = {
  id: string;
  khata_no: string;
  mouza_od: string;
  mouza_en: string;
  district_od: string;
  tehsil_od: string;
  tehsil_no?: string;
  police_station_od?: string;
  police_station_no?: string;
  recorded_holders_od: string;
  tenure_od: string;
  special_remarks_od?: string;
  final_publication_date?: string;
  source_printed_timestamp?: string;
  plot_count: number;
  total_acres: number;
  issues: string[];
  source?: { slug: string; pages: number; source_pdf: string; pdf_sha256: string } | null;
  plots: Plot[];
  revision_count?: number;
};

type Person = {
  id: string;
  label_od: string;
  label_en: string;
  aliases: string[];
  khata_numbers: string[];
  role: 'recorded_holder';
};

type Bundle = {
  khatas: Khata[];
  people: Person[];
  person_review_queue: Array<{ id: string; reason: string; khata_numbers: string[] }>;
  summary: { khatas: number; plots: number; total_acres: number };
};

const text = {
  or: {
    title: 'ପରିବାର ଜମି ରେକର୍ଡ', subtitle: 'Family Land Register', back: '← ପଛକୁ', home: 'ମୂଳ ପୃଷ୍ଠା',
    findKhata: 'ଖାତା ଖୋଜନ୍ତୁ', findPerson: 'ବ୍ୟକ୍ତିଙ୍କ ନାମରେ ଦେଖନ୍ତୁ', viewMaps: 'ପ୍ଲଟ୍ ମାନଚିତ୍ର ଦେଖନ୍ତୁ',
    welcome: 'ନମସ୍କାର, ଆଜି କଣ ଦେଖିବେ?', search: 'ଖାତା କିମ୍ବା ପ୍ଲଟ୍ ନମ୍ବର ଖୋଜନ୍ତୁ',
    village: 'ମୌଜା / Village', person: 'ବ୍ୟକ୍ତି / Person', kisam: 'କିସମ / Land type', all: 'ସବୁ / All',
    clear: 'ସଫା କରନ୍ତୁ', results: 'ମେଳ ଖାଇଥିବା ରେକର୍ଡ', khata: 'ଖାତା', plots: 'ପ୍ଲଟ୍', listedArea: 'ତାଲିକାଭୁକ୍ତ ରକବା',
    holders: 'ରେକର୍ଡରେ ଥିବା ନାମ', tenure: 'ରେକର୍ଡର ସ୍ଵତ୍ଵ', plotNo: 'ପ୍ଲଟ୍ ନଂ', landClass: 'କିସମ', area: 'ରକବା', open: 'ଖୋଲନ୍ତୁ',
    options: 'ଟେବୁଲ୍ ବିକଳ୍ପ', signOut: 'ସାଇନ୍ ଆଉଟ୍', originalPdf: 'ମୂଳ PDF', capture: 'ଛବି ନିଅନ୍ତୁ', print: 'ପ୍ରିଣ୍ଟ୍',
    sourceWording: 'ମୂଳ ଲେଖା ଦେଖନ୍ତୁ', officialMap: 'ଓଡ଼ିଶାର ସରକାରୀ ପ୍ଲଟ୍ ମାନଚିତ୍ର ଖୋଲନ୍ତୁ',
    mapStatus: 'ମାନଚିତ୍ର ସ୍ଥିତି', notMapped: 'ଏହି ପ୍ଲଟ୍‌ର ସଠିକ୍ ସୀମାରେଖା ଏପର୍ଯ୍ୟନ୍ତ ଯାଞ୍ଚ ହୋଇନାହିଁ।',
    copyFields: 'ସରକାରୀ ଖୋଜ ତଥ୍ୟ କପି କରନ୍ତୁ', riUnknown: 'RI ସର୍କଲ୍: ଅଜଣା — ସରକାରୀ ସାଇଟ୍‌ରେ ବାଛନ୍ତୁ',
    comparison: 'ରକବା ତୁଳନା', comparisonNote: 'କେବଳ ରକବା ତୁଳନା — ଏହା ଜମିର ପ୍ରକୃତ ଆକୃତି ନୁହେଁ।',
    compareWith: 'ଆଉ ଏକ ପ୍ଲଟ୍ ସହିତ ତୁଳନା କରନ୍ତୁ', needsReview: 'ଯାଞ୍ଚ ଆବଶ୍ୟକ', more: 'ଅଧିକ ରେକର୍ଡ ବିବରଣୀ',
    disclaimer: 'ରେକର୍ଡରେ ଥିବା ଜମି ବିବରଣୀ; ବର୍ତ୍ତମାନ ମାଲିକାନାର ପ୍ରମାଣ ନୁହେଁ।',
    noResults: 'କୌଣସି ରେକର୍ଡ ମିଳିଲା ନାହିଁ। ଫିଲ୍ଟର୍ ସଫା କରି ପୁଣି ଦେଖନ୍ତୁ।',
  },
  en: {
    title: 'Family Land Register', subtitle: 'ପରିବାର ଜମି ରେକର୍ଡ', back: '← Back', home: 'Home',
    findKhata: 'Find a Khata', findPerson: 'Find a Person', viewMaps: 'View Plot Maps',
    welcome: 'Welcome. What would you like to look up?', search: 'Search khata or plot number',
    village: 'Village / ମୌଜା', person: 'Person / ବ୍ୟକ୍ତି', kisam: 'Land type / କିସମ', all: 'All',
    clear: 'Clear', results: 'matching records', khata: 'Khata', plots: 'plots', listedArea: 'Listed area',
    holders: 'Recorded holder(s)', tenure: 'Recorded tenure', plotNo: 'Plot no.', landClass: 'Land class', area: 'Area', open: 'Open',
    options: 'Table options', signOut: 'Sign out', originalPdf: 'Original PDF', capture: 'Capture', print: 'Print',
    sourceWording: 'View source wording', officialMap: 'Open Odisha Official Plot Map',
    mapStatus: 'Map status', notMapped: 'The exact cadastral outline for this plot has not been verified.',
    copyFields: 'Copy official lookup fields', riUnknown: 'RI circle: Unknown — select it on the government site',
    comparison: 'Area comparison', comparisonNote: 'Area comparison only — not the actual land shape.',
    compareWith: 'Compare with another plot', needsReview: 'Needs review', more: 'More record details',
    disclaimer: 'Recorded land details; not proof of current title.',
    noResults: 'No records match. Clear the filters and try again.',
  },
};

const classGloss: Record<string, string> = {
  'ଘରବାରି': 'Gharabari / homestead classification',
  'ଶାରଦ ଏକ': 'Sharada one',
  'ଶାରଦ ଦୁଇ': 'Sharada two',
  'ଶାରଦ ତିନି': 'Sharada three',
  'ଶାରଦ ଦୋଫସଲି ଦୁଇ': 'Sharada double-crop two',
  'ପତିତ': 'Patita / fallow classification',
  'ବଗାୟତ ଦୁଇ': 'Bagayat two',
};

const standardColumns: ColumnKey[] = ['plot', 'kisam', 'area', 'action'];
const allColumns: ColumnKey[] = ['plot', 'kisam', 'local', 'area', 'action'];
const columnLabels: Record<ColumnKey, { or: string; en: string }> = {
  plot: { or: 'ପ୍ଲଟ୍ ନଂ', en: 'Plot no.' }, kisam: { or: 'କିସମ', en: 'Land class' },
  local: { or: 'ଚକ / ସ୍ଥାନ', en: 'Local name' }, area: { or: 'ରକବା', en: 'Area' }, action: { or: 'ଖୋଲନ୍ତୁ', en: 'Open' },
};

const readStored = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
};

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export default function LandRegisterApp({ bundle }: { bundle: Bundle }) {
  const [lang, setLang] = useState<Language>('or');
  const [fontScale, setFontScale] = useState<FontScale>('normal');
  const [view, setView] = useState<View>('home');
  const [selectedKhataId, setSelectedKhataId] = useState<string>('');
  const [selectedPlotId, setSelectedPlotId] = useState<string>('');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [mouzaFilter, setMouzaFilter] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [kisamFilter, setKisamFilter] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(standardColumns);
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(allColumns);
  const [arrangeColumn, setArrangeColumn] = useState<ColumnKey>('kisam');
  const [comparePlotId, setComparePlotId] = useState('');
  const [captureUrl, setCaptureUrl] = useState('');
  const [captureMessage, setCaptureMessage] = useState('');
  const [selectingArea, setSelectingArea] = useState(false);
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [sourceText, setSourceText] = useState('');
  const optionsDialog = useRef<HTMLDialogElement>(null);
  const captureDialog = useRef<HTMLDialogElement>(null);
  const sourceDialog = useRef<HTMLDialogElement>(null);
  const recordRef = useRef<HTMLElement>(null);
  const t = text[lang];

  useEffect(() => {
    setLang(readStored<Language>('land-language', 'or'));
    setFontScale(readStored<FontScale>('land-font-scale', 'normal'));
    setVisibleColumns(readStored<ColumnKey[]>('land-visible-columns', standardColumns));
    setColumnOrder(readStored<ColumnKey[]>('land-column-order', allColumns));
    const initial = { view: 'home' as View, selectedKhataId: '', selectedPlotId: '', selectedPersonId: '' };
    history.replaceState({ land: initial }, '', '/land');
    const onPopState = (event: PopStateEvent) => {
      const state = event.state?.land || initial;
      setView(state.view);
      setSelectedKhataId(state.selectedKhataId || '');
      setSelectedPlotId(state.selectedPlotId || '');
      setSelectedPersonId(state.selectedPersonId || '');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('land-language', JSON.stringify(lang));
  }, [lang]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.getElementById('land-main')?.focus({ preventScroll: true });
  }, [view, selectedKhataId, selectedPersonId]);
  useEffect(() => { localStorage.setItem('land-font-scale', JSON.stringify(fontScale)); }, [fontScale]);
  useEffect(() => { localStorage.setItem('land-visible-columns', JSON.stringify(visibleColumns)); }, [visibleColumns]);
  useEffect(() => { localStorage.setItem('land-column-order', JSON.stringify(columnOrder)); }, [columnOrder]);
  useEffect(() => {
    if (!selectingArea) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectingArea(false);
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [selectingArea]);

  const navigate = (nextView: View, state: Partial<{ khata: string; plot: string; person: string }> = {}) => {
    const next = {
      view: nextView,
      selectedKhataId: state.khata ?? selectedKhataId,
      selectedPlotId: state.plot ?? selectedPlotId,
      selectedPersonId: state.person ?? selectedPersonId,
    };
    history.pushState({ land: next }, '', '/land');
    setView(nextView);
    setSelectedKhataId(next.selectedKhataId);
    setSelectedPlotId(next.selectedPlotId);
    setSelectedPersonId(next.selectedPersonId);
  };

  const selectedKhata = bundle.khatas.find((khata) => khata.id === selectedKhataId) || null;
  const selectedPlot = selectedKhata?.plots.find((plot) => plot.id === selectedPlotId) || selectedKhata?.plots[0] || null;
  const selectedPerson = bundle.people.find((person) => person.id === selectedPersonId) || null;

  const villages = useMemo(() => Array.from(new Map(bundle.khatas.map((k) => [k.mouza_od, k])).values()), [bundle.khatas]);
  const landClasses = useMemo(() => Array.from(new Set(bundle.khatas.flatMap((k) => k.plots.map((p) => p.land_class_od)))).sort(), [bundle.khatas]);

  const filteredKhatas = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const person = bundle.people.find((item) => item.id === personFilter);
    return bundle.khatas.flatMap((khata) => {
      if (mouzaFilter && khata.mouza_od !== mouzaFilter) return [];
      if (person && !person.khata_numbers.includes(String(khata.khata_no))) return [];
      const aliases = bundle.people.filter((item) => item.khata_numbers.includes(String(khata.khata_no))).flatMap((item) => item.aliases);
      const matchingPlots = khata.plots.filter((plot) => {
        if (kisamFilter && plot.land_class_od !== kisamFilter) return false;
        if (!query) return true;
        return [khata.khata_no, khata.mouza_od, khata.mouza_en, plot.plot_no, plot.local_name_od, plot.land_class_od, ...aliases]
          .some((value) => String(value || '').toLocaleLowerCase().includes(query));
      });
      return matchingPlots.length ? [{ ...khata, matchingPlots }] : [];
    });
  }, [bundle.khatas, bundle.people, search, mouzaFilter, personFilter, kisamFilter]);

  const matchingPlotCount = filteredKhatas.reduce((sum, khata) => sum + khata.matchingPlots.length, 0);
  const matchingAcres = filteredKhatas.reduce((sum, khata) => sum + khata.matchingPlots.reduce((plotSum, plot) => plotSum + Number(plot.area_acres), 0), 0);
  const activeColumns = columnOrder.filter((column) => visibleColumns.includes(column));

  const openKhata = (khata: Khata, plot?: Plot) => {
    const plotId = plot?.id || khata.plots[0]?.id || '';
    setComparePlotId('');
    navigate('detail', { khata: khata.id, plot: plotId });
  };

  const clearFilters = () => {
    setSearch(''); setMouzaFilter(''); setPersonFilter(''); setKisamFilter('');
  };

  const moveColumn = (direction: -1 | 1) => {
    setColumnOrder((current) => {
      const next = [...current];
      const index = next.indexOf(arrangeColumn);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const restoreTable = () => {
    setVisibleColumns(standardColumns);
    setColumnOrder(allColumns);
  };

  const downloadText = (contents: string, name: string, type: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    URL.revokeObjectURL(url);
  };

  const exportRecords = () => {
    const rows = [['Khata', 'Mouza', 'Plot', 'Kisam', 'Acres', 'Source']];
    for (const khata of filteredKhatas) {
      for (const plot of khata.matchingPlots) rows.push([khata.khata_no, khata.mouza_od, plot.plot_no, plot.land_class_od, String(plot.area_acres), plot.source_reference]);
    }
    downloadText(rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'family-land-records.csv', 'text/csv;charset=utf-8');
  };

  const captureElement = async (element: HTMLElement) => {
    setCaptureMessage(lang === 'or' ? 'ଛବି ପ୍ରସ୍ତୁତ ହେଉଛି…' : 'Preparing image…');
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(element, { backgroundColor: '#fff8e8', scale: 2, useCORS: false, logging: false });
    setCaptureUrl(canvas.toDataURL('image/png'));
    setCaptureMessage('');
    captureDialog.current?.showModal();
  };

  const beginAreaSelection = () => {
    captureDialog.current?.close();
    setSelection(null);
    setSelectingArea(true);
  };

  const finishAreaSelection = async (rect: { x: number; y: number; width: number; height: number }) => {
    setSelectingArea(false);
    if (rect.width < 20 || rect.height < 20) return;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(document.querySelector('.land-app') as HTMLElement, { backgroundColor: '#fff8e8', scale: 2, logging: false });
    const appRect = (document.querySelector('.land-app') as HTMLElement).getBoundingClientRect();
    const crop = document.createElement('canvas');
    crop.width = rect.width * 2; crop.height = rect.height * 2;
    crop.getContext('2d')?.drawImage(canvas, (rect.x - appRect.left) * 2, (rect.y - appRect.top) * 2, rect.width * 2, rect.height * 2, 0, 0, crop.width, crop.height);
    setCaptureUrl(crop.toDataURL('image/png'));
    captureDialog.current?.showModal();
  };

  const downloadCapture = () => {
    if (!captureUrl) return;
    const link = document.createElement('a'); link.href = captureUrl;
    link.download = `land-record-${selectedKhata?.khata_no?.replaceAll('/', '-') || 'selection'}.png`;
    link.click(); setCaptureMessage(lang === 'or' ? 'ଛବି Downloads ଫୋଲ୍ଡର୍‌ରେ ସେଭ୍ ହେଲା।' : 'Image saved to your Downloads folder.');
  };

  const shareCapture = async () => {
    if (!captureUrl) return;
    const blob = await (await fetch(captureUrl)).blob();
    const file = new File([blob], 'family-land-record.png', { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Family land record' });
      } else {
        setCaptureMessage(lang === 'or' ? 'ଏହି ବ୍ରାଉଜର୍‌ରେ ଫାଇଲ୍ Share ନାହିଁ। ତଳେ ଥିବା ବିକଳ୍ପ ବ୍ୟବହାର କରନ୍ତୁ।' : 'File sharing is not available in this browser. Use a fallback below.');
      }
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') setCaptureMessage(lang === 'or' ? 'Share ହୋଇପାରିଲା ନାହିଁ। ଛବି Download କରନ୍ତୁ।' : 'Sharing failed. Download the image instead.');
    }
  };

  const copyCapture = async () => {
    try {
      const blob = await (await fetch(captureUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCaptureMessage(lang === 'or' ? 'ଛବି କପି ହେଲା।' : 'Image copied.');
    } catch { setCaptureMessage(lang === 'or' ? 'ଛବି କପି ହୋଇପାରିଲା ନାହିଁ। Download କରନ୍ତୁ।' : 'Copy is unavailable. Download the image instead.'); }
  };

  const openCaptureMenu = () => {
    setCaptureUrl(''); setCaptureMessage(''); captureDialog.current?.showModal();
  };

  const openSource = async () => {
    if (!selectedKhata?.source) return;
    setSourceText(lang === 'or' ? 'ମୂଳ ଲେଖା ଖୋଲୁଛି…' : 'Loading source wording…');
    sourceDialog.current?.showModal();
    const response = await fetch(`/api/land/source/${selectedKhata.source.slug}`);
    const result = await response.json();
    setSourceText(response.ok ? result.markdown : (result.error || 'Source unavailable.'));
  };

  const signOut = async () => {
    await fetch('/api/land/session', { method: 'DELETE', credentials: 'same-origin' });
    window.location.replace('/land');
  };

  const copyLookup = async () => {
    if (!selectedKhata || !selectedPlot) return;
    const value = `District: ${selectedKhata.district_od}\nTehsil: ${selectedKhata.tehsil_od}\nMouza: ${selectedKhata.mouza_od}\nRI circle: Unknown\nKhata: ${selectedKhata.khata_no}\nPlot: ${selectedPlot.plot_no}`;
    await navigator.clipboard.writeText(value);
    setCaptureMessage(lang === 'or' ? 'ଖୋଜ ତଥ୍ୟ କପି ହେଲା।' : 'Lookup fields copied.');
  };

  const plotLabel = (plot: Plot) => `${plot.plot_no} · ${plot.area_acres.toFixed(4)} ac`;
  const comparePlot = bundle.khatas.flatMap((khata) => khata.plots).find((plot) => plot.id === comparePlotId) || null;

  const renderFilters = () => (
    <section className="land-filters" aria-label={lang === 'or' ? 'ରେକର୍ଡ ଫିଲ୍ଟର୍' : 'Record filters'}>
      <div className="land-search-field">
        <label htmlFor="land-search">{t.search}</label>
        <input id="land-search" type="search" inputMode="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="land-filter-grid">
        <label>{t.village}<select value={mouzaFilter} onChange={(event) => setMouzaFilter(event.target.value)}><option value="">{t.all}</option>{villages.map((item) => <option key={item.mouza_od} value={item.mouza_od}>{item.mouza_od} · {item.mouza_en}</option>)}</select></label>
        <label>{t.person}<select value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}><option value="">{t.all}</option>{bundle.people.map((person) => <option key={person.id} value={person.id}>{person.label_od} · {person.label_en}</option>)}</select></label>
        <label>{t.kisam}<select value={kisamFilter} onChange={(event) => setKisamFilter(event.target.value)}><option value="">{t.all}</option>{landClasses.map((value) => <option key={value} value={value}>{value}{lang === 'en' && classGloss[value] ? ` · ${classGloss[value]}` : ''}</option>)}</select></label>
      </div>
      <div className="land-filter-summary" aria-live="polite">
        <p><strong>{matchingPlotCount}</strong> {t.results} · {matchingAcres.toFixed(4)} acres ({lang === 'or' ? 'ମେଳ ଖାଇଥିବା ପ୍ଲଟ୍ ଧାଡ଼ିର ରକବା' : 'area in matched plot rows'})</p>
        <button type="button" className="land-text-button" onClick={clearFilters}>{t.clear}</button>
      </div>
    </section>
  );

  const renderKhataList = () => (
    <section className="land-list-section" aria-labelledby="khata-list-title">
      <div className="land-section-heading"><div><p className="land-kicker">{t.results}</p><h2 id="khata-list-title">{view === 'maps' ? t.viewMaps : t.findKhata}</h2></div><span>{filteredKhatas.length} {t.khata} · {matchingPlotCount} {t.plots}</span></div>
      {filteredKhatas.length ? <ul className="land-khata-list">
        {filteredKhatas.map((khata) => <li key={khata.id}>
          <button type="button" className="land-khata-row" onClick={() => openKhata(khata)}>
            <span className="land-khata-number">{t.khata} {khata.khata_no}</span>
            <span>{khata.mouza_od}<small>{khata.mouza_en}</small></span>
            <span>{khata.matchingPlots.length} {t.plots}<small>{khata.matchingPlots.reduce((sum, plot) => sum + plot.area_acres, 0).toFixed(4)} acres</small></span>
            <span className="land-row-open">{t.open} →</span>
          </button>
        </li>)}
      </ul> : <div className="land-empty"><p>{t.noResults}</p><button className="land-button land-button--secondary" onClick={clearFilters}>{t.clear}</button></div>}
    </section>
  );

  const renderPeople = () => {
    const people = bundle.people.filter((person) => {
      if (personFilter && person.id !== personFilter) return false;
      const query = search.toLocaleLowerCase().trim();
      return !query || person.aliases.some((alias) => alias.toLocaleLowerCase().includes(query));
    });
    return <section className="land-list-section" aria-labelledby="person-list-title">
      <div className="land-section-heading"><div><p className="land-kicker">{t.holders}</p><h2 id="person-list-title">{t.findPerson}</h2></div><span>{people.length} {lang === 'or' ? 'ନାମ' : 'names'}</span></div>
      <p className="land-inline-note">{lang === 'or' ? 'ଏହି ତାଲିକା କେବଳ ଯାଞ୍ଚ ହୋଇଥିବା ରେକର୍ଡ ଧାରକଙ୍କ ନାମ ଦେଖାଏ।' : 'This list matches reviewed recorded-holder names only. English spellings are phonetic indexing aids.'}</p>
      <ul className="land-person-list">{people.map((person) => <li key={person.id}><button type="button" onClick={() => navigate('person', { person: person.id })}><strong>{person.label_od}</strong><span>{person.label_en}</span><small>{person.khata_numbers.length} {t.khata}</small></button></li>)}</ul>
    </section>;
  };

  const renderPersonDetail = () => {
    if (!selectedPerson) return null;
    const khatas = bundle.khatas.filter((khata) => selectedPerson.khata_numbers.includes(String(khata.khata_no)));
    return <section className="land-person-detail" aria-labelledby="person-title">
      <p className="land-kicker">{t.holders}</p><h1 id="person-title">{selectedPerson.label_od}</h1><p className="land-subtitle">{selectedPerson.label_en} · {lang === 'or' ? 'ଧ୍ୱନିଗତ ଇଂରାଜୀ ନାମ' : 'phonetic English indexing aid'}</p>
      <div className="land-role-label">{lang === 'or' ? 'ଭୂମିକା: ରେକର୍ଡରେ ଥିବା ନାମ' : 'Role: Recorded holder'}</div>
      <p className="land-disclaimer">{lang === 'or' ? 'ନାମ ଥିବାର ଅର୍ଥ ଏକଚାଟିଆ ମାଲିକାନା କିମ୍ବା ନିର୍ଦ୍ଦିଷ୍ଟ ଅଂଶ ନୁହେଁ।' : 'Appearance in a group khata does not establish exclusive ownership or a specific share.'}</p>
      <h2>{lang === 'or' ? 'ସଂଯୁକ୍ତ ଖାତା ଓ ପ୍ଲଟ୍' : 'Linked khatas and plots'}</h2>
      <ul className="land-linked-records">{khatas.map((khata) => <li key={khata.id}><button type="button" onClick={() => openKhata(khata)}><strong>{t.khata} {khata.khata_no}</strong><span>{khata.mouza_od} · {khata.plot_count} {t.plots}</span><span>{khata.plots.map((plot) => plot.plot_no).join(', ')}</span></button></li>)}</ul>
    </section>;
  };

  const renderAreaGlyph = (plot: Plot, maxArea: number, label: string) => {
    const side = Math.max(2, 160 * Math.sqrt(plot.area_acres / maxArea));
    return <figure className="land-area-glyph"><div className="land-area-square" style={{ inlineSize: `${side}px`, blockSize: `${side}px` }} aria-hidden="true" /><figcaption><strong>{label}</strong><span>{plot.area_acres.toFixed(4)} acres</span><span>{plot.area_sqft.toLocaleString('en-IN', { maximumFractionDigits: 2 })} sq ft</span></figcaption></figure>;
  };

  const renderDetail = () => {
    if (!selectedKhata || !selectedPlot) return null;
    const maxArea = Math.max(selectedPlot.area_acres, comparePlot?.area_acres || 0);
    return <article className="land-record-page" ref={recordRef} aria-labelledby="khata-title">
      <div className="land-breadcrumb">{t.home} › {t.khata} › {selectedKhata.khata_no}</div>
      <header className="land-record-header">
        <div><p className="land-kicker">{selectedKhata.mouza_od} · {selectedKhata.district_od}</p><h1 id="khata-title">{lang === 'or' ? 'ଖାତା ନଂ' : 'Khata'} {selectedKhata.khata_no}</h1><p className="land-subtitle">{selectedKhata.plot_count} {t.plots} · {selectedKhata.total_acres.toFixed(4)} acres</p></div>
        {selectedKhata.issues?.length > 0 && <span className="land-review-badge">{t.needsReview}</span>}
      </header>
      <section className="land-record-summary" aria-label={lang === 'or' ? 'ଖାତା ସାରାଂଶ' : 'Khata summary'}>
        <div><span>{t.village}</span><strong>{selectedKhata.mouza_od}</strong><small>{selectedKhata.mouza_en}</small></div>
        <div><span>{t.tenure}</span><strong>{selectedKhata.tenure_od}</strong></div>
        <div className="land-holder-summary"><span>{t.holders}</span><strong>{selectedKhata.recorded_holders_od}</strong></div>
      </section>
      <div className="land-detail-grid">
        <section className="land-plot-table-section" aria-labelledby="plot-table-title">
          <div className="land-section-heading land-section-heading--compact"><h2 id="plot-table-title">{lang === 'or' ? 'ପ୍ଲଟ୍ ବିବରଣୀ' : 'Plot details'}</h2><span>{selectedKhata.plots.length} {t.plots}</span></div>
          <div className="land-table-wrapper">
            <table className="land-plot-table">
              <caption className="visually-hidden">{t.khata} {selectedKhata.khata_no} {t.plots}</caption>
              <thead><tr>{activeColumns.map((column) => <th scope="col" key={column} className={`col-${column}`}>{columnLabels[column][lang]}</th>)}</tr></thead>
              <tbody>{selectedKhata.plots.map((plot) => <tr key={plot.id} className={plot.id === selectedPlot.id ? 'is-selected' : ''}>
                {activeColumns.map((column) => {
                  const label = columnLabels[column][lang];
                  if (column === 'plot') return <th scope="row" key={column} data-label={label}>{plot.plot_no}</th>;
                  if (column === 'kisam') return <td key={column} data-label={label}>{plot.land_class_od}{lang === 'en' && classGloss[plot.land_class_od] && <small>{classGloss[plot.land_class_od]}</small>}</td>;
                  if (column === 'local') return <td key={column} data-label={label}>{plot.local_name_od || '—'}</td>;
                  if (column === 'area') return <td key={column} data-label={label} className="land-number">{plot.area_acres.toFixed(4)} <small>acres</small></td>;
                  return <td key={column} data-label={label}><button type="button" className="land-row-button" aria-pressed={plot.id === selectedPlot.id} onClick={() => setSelectedPlotId(plot.id)}>{plot.id === selectedPlot.id ? (lang === 'or' ? 'ବଛାଗଲା' : 'Selected') : t.open}</button></td>;
                })}
              </tr>)}</tbody>
            </table>
          </div>
        </section>
        <aside className="land-plot-panel" aria-labelledby="selected-plot-title">
          <p className="land-kicker">{lang === 'or' ? 'ବଛାଯାଇଥିବା ପ୍ଲଟ୍' : 'Selected plot'}</p>
          <h2 id="selected-plot-title">{t.plotNo} {selectedPlot.plot_no}</h2>
          <dl className="land-plot-facts"><div><dt>{t.landClass}</dt><dd>{selectedPlot.land_class_od}</dd></div><div><dt>{t.area}</dt><dd>{selectedPlot.area_acres.toFixed(4)} acres</dd></div><div><dt>Square feet</dt><dd>{selectedPlot.area_sqft.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</dd></div></dl>
          <div className="land-map-status"><strong>{t.mapStatus}: {lang === 'or' ? 'ଯାଞ୍ଚ ହୋଇନାହିଁ' : 'Not yet mapped'}</strong><p>{t.notMapped}</p></div>
          <a className="land-button land-button--primary land-map-button" href="https://bhunakshaodisha.nic.in/" target="_blank" rel="noopener noreferrer">{t.officialMap} ↗</a>
          <dl className="land-lookup-fields"><div><dt>District</dt><dd>{selectedKhata.district_od}</dd></div><div><dt>Tehsil</dt><dd>{selectedKhata.tehsil_od}</dd></div><div><dt>Mouza</dt><dd>{selectedKhata.mouza_od}</dd></div><div><dt>Khata</dt><dd>{selectedKhata.khata_no}</dd></div><div><dt>Plot</dt><dd>{selectedPlot.plot_no}</dd></div></dl>
          <p className="land-ri-note">{t.riUnknown}</p>
          <button type="button" className="land-button land-button--secondary" onClick={copyLookup}>{t.copyFields}</button>
        </aside>
      </div>
      <section className="land-area-comparison" aria-labelledby="area-comparison-title">
        <div className="land-section-heading land-section-heading--compact"><div><h2 id="area-comparison-title">{t.comparison}</h2><p>{t.comparisonNote}</p></div><label>{t.compareWith}<select value={comparePlotId} onChange={(event) => setComparePlotId(event.target.value)}><option value="">{lang === 'or' ? 'ବାଛନ୍ତୁ' : 'Choose a plot'}</option>{bundle.khatas.flatMap((khata) => khata.plots.map((plot) => <option key={plot.id} value={plot.id}>{khata.khata_no} / {plotLabel(plot)}</option>))}</select></label></div>
        <div className="land-glyph-row">{renderAreaGlyph(selectedPlot, maxArea, `${selectedKhata.khata_no} / ${selectedPlot.plot_no}`)}{comparePlot && renderAreaGlyph(comparePlot, maxArea, comparePlot.plot_no)}</div>
      </section>
      {(selectedKhata.issues?.length > 0 || selectedPlot.boundaries_od || selectedPlot.remarks_od || selectedKhata.special_remarks_od) && <details className="land-more-details"><summary>{t.more}</summary><div>
        {selectedKhata.issues?.map((issue) => <p className="land-issue" key={issue}><strong>{t.needsReview}:</strong> {issue}</p>)}
        {selectedPlot.boundaries_od && <p><strong>{lang === 'or' ? 'ଚୌହଦି' : 'Boundary wording'}:</strong> {selectedPlot.boundaries_od}</p>}
        {selectedPlot.remarks_od && <p><strong>{lang === 'or' ? 'ପ୍ଲଟ୍ ମନ୍ତବ୍ୟ' : 'Plot remark'}:</strong> {selectedPlot.remarks_od}</p>}
        {selectedKhata.special_remarks_od && <p><strong>{lang === 'or' ? 'ବିଶେଷ ଅନୁସଙ୍ଗ' : 'Special remarks'}:</strong> {selectedKhata.special_remarks_od}</p>}
      </div></details>}
      <footer className="land-record-footer"><div><strong>Source: Odisha Bhulekh PDF, page 1/2</strong><span>Printed: {selectedKhata.source_printed_timestamp || 'Not recorded'} · {selectedKhata.source?.pdf_sha256 ? `SHA-256 ${selectedKhata.source.pdf_sha256.slice(0, 12)}…` : 'Reviewed admin addition'}</span></div><p>{t.disclaimer}</p></footer>
      <div className="land-record-actions">
        {selectedKhata.source && <a className="land-button land-button--primary" href={`/api/land/pdf/${selectedKhata.source.slug}`} target="_blank" rel="noopener noreferrer">{t.originalPdf}</a>}
        <button className="land-button land-button--secondary" type="button" onClick={openCaptureMenu}>{t.capture}</button>
        <button className="land-button land-button--secondary" type="button" onClick={() => window.print()}>{t.print}</button>
        {selectedKhata.source && <button className="land-text-button" type="button" onClick={openSource}>{t.sourceWording}</button>}
      </div>
    </article>;
  };

  return <div className="land-app" data-font-scale={fontScale}>
    <header className="land-app-bar">
      <div className="land-bar-left">{view !== 'home' ? <button type="button" className="land-back-button" onClick={() => history.back()}>{t.back}</button> : <span className="land-brand-mark">ABODID</span>}<button type="button" className="land-home-button" onClick={() => navigate('home', { khata: '', plot: '', person: '' })}>{t.home}</button></div>
      <div className="land-bar-title"><strong>{t.title}</strong><span>{t.subtitle}</span></div>
      <div className="land-utilities">
        <span className="land-font-controls" aria-label={lang === 'or' ? 'ଅକ୍ଷର ଆକାର' : 'Text size'}><button type="button" onClick={() => setFontScale('normal')} aria-pressed={fontScale === 'normal'}>A−</button><button type="button" onClick={() => setFontScale(fontScale === 'normal' ? 'large' : 'xlarge')} aria-pressed={fontScale !== 'normal'}>A+</button></span>
        <button type="button" onClick={() => setLang(lang === 'or' ? 'en' : 'or')}>{lang === 'or' ? 'English' : 'ଓଡ଼ିଆ'}</button>
        <button type="button" onClick={() => optionsDialog.current?.showModal()}>{t.options}</button>
        <button type="button" onClick={signOut}>{t.signOut}</button>
      </div>
    </header>
    <div className="land-content">
      {view === 'home' && <><section className="land-hero" aria-labelledby="land-welcome"><p className="land-kicker">{bundle.summary.khatas} {t.khata} · {bundle.summary.plots} {t.plots} · {bundle.summary.total_acres.toFixed(4)} acres {t.listedArea}</p><h1 id="land-welcome">{t.welcome}</h1><div className="land-primary-choices"><button onClick={() => navigate('khatas')}><span>1</span><strong>{t.findKhata}</strong></button><button onClick={() => navigate('people')}><span>2</span><strong>{t.findPerson}</strong></button><button onClick={() => navigate('maps')}><span>3</span><strong>{t.viewMaps}</strong></button></div><p className="land-disclaimer">{t.disclaimer}</p></section>{renderFilters()}{renderKhataList()}</>}
      {(view === 'khatas' || view === 'maps') && <>{renderFilters()}{renderKhataList()}</>}
      {view === 'people' && <>{renderFilters()}{renderPeople()}</>}
      {view === 'person' && renderPersonDetail()}
      {view === 'detail' && renderDetail()}
    </div>

    <dialog className="land-dialog" ref={optionsDialog} aria-labelledby="table-options-title"><form method="dialog"><div className="land-dialog-heading"><h2 id="table-options-title">{t.options}</h2><button className="land-dialog-close" aria-label="Close">×</button></div></form><div className="land-options-grid"><section><strong>1. {lang === 'or' ? 'କଲମ୍ ଦେଖାନ୍ତୁ / ଲୁଚାନ୍ତୁ' : 'Show / hide columns'}</strong>{allColumns.map((column) => <label className="land-checkbox-row" key={column}><input type="checkbox" checked={visibleColumns.includes(column)} onChange={(event) => setVisibleColumns((current) => event.target.checked ? [...new Set([...current, column])] : current.filter((item) => item !== column))} /><span>{columnLabels[column][lang]}</span></label>)}</section><section><strong>2. {lang === 'or' ? 'କଲମ୍ ସଜାନ୍ତୁ' : 'Arrange columns'}</strong><label>{lang === 'or' ? 'କଲମ୍ ବାଛନ୍ତୁ' : 'Choose column'}<select value={arrangeColumn} onChange={(event) => setArrangeColumn(event.target.value as ColumnKey)}>{allColumns.map((column) => <option key={column} value={column}>{columnLabels[column][lang]}</option>)}</select></label><div className="land-two-buttons"><button className="land-button land-button--secondary" onClick={() => moveColumn(-1)}>{lang === 'or' ? 'ବାମକୁ' : 'Move left'}</button><button className="land-button land-button--secondary" onClick={() => moveColumn(1)}>{lang === 'or' ? 'ଡାହାଣକୁ' : 'Move right'}</button></div></section><section><strong>3. {lang === 'or' ? 'ଡାଟା' : 'Data'}</strong><button className="land-button land-button--secondary" onClick={restoreTable}>{lang === 'or' ? 'ସାଧାରଣ ଦୃଶ୍ୟ ଫେରାନ୍ତୁ' : 'Restore standard view'}</button><button className="land-button land-button--secondary" onClick={exportRecords}>{lang === 'or' ? 'ବଛା ରେକର୍ଡ Export କରନ୍ତୁ' : 'Export matching records'}</button><button className="land-button land-button--secondary" onClick={() => window.print()}>{t.print}</button></section></div></dialog>

    <dialog className="land-dialog land-capture-dialog" ref={captureDialog} aria-labelledby="capture-title"><div className="land-dialog-heading"><h2 id="capture-title">{t.capture}</h2><button className="land-dialog-close" aria-label="Close" onClick={() => captureDialog.current?.close()}>×</button></div>{captureUrl ? <><img className="land-capture-preview" src={captureUrl} alt={lang === 'or' ? 'ଧରାଯାଇଥିବା ରେକର୍ଡ ଛବି' : 'Captured record preview'} /><p className="land-inline-note">{lang === 'or' ? 'ଏହା ସରକାରୀ ପ୍ରମାଣିତ ନକଲ୍ ନୁହେଁ।' : 'This is not a government-certified extract.'}</p><div className="land-three-actions"><button className="land-button land-button--primary" onClick={downloadCapture}>Download PNG</button><button className="land-button land-button--secondary" onClick={shareCapture}>Share</button><button className="land-button land-button--secondary" onClick={() => captureDialog.current?.close()}>{lang === 'or' ? 'ପଛକୁ' : 'Back'}</button></div><details className="land-share-fallback"><summary>{lang === 'or' ? 'ଅନ୍ୟ Share ବିକଳ୍ପ' : 'Other sharing options'}</summary><button onClick={copyCapture}>Copy image</button><a href={`https://wa.me/?text=${encodeURIComponent('Family land record image — attach the downloaded PNG manually.')}`} target="_blank" rel="noopener noreferrer">Open WhatsApp (attach image manually)</a><a href={`mailto:?subject=${encodeURIComponent('Family land record')}&body=${encodeURIComponent('Please attach the downloaded PNG manually.')}`}>Compose email (attach image manually)</a></details></> : <div className="land-capture-choices"><button className="land-choice-card" onClick={() => recordRef.current && captureElement(recordRef.current)}><strong>{lang === 'or' ? 'ଏହି ରେକର୍ଡର ଛବି' : 'Capture this record'}</strong><span>{lang === 'or' ? 'ସବୁଠାରୁ ଭରସାଯୋଗ୍ୟ' : 'Recommended and reliable'}</span></button><button className="land-choice-card" onClick={beginAreaSelection}><strong>{lang === 'or' ? 'ଏକ ଅଂଶ ବାଛନ୍ତୁ' : 'Select an area'}</strong><span>{lang === 'or' ? 'ଏହି ପୃଷ୍ଠା ଭିତରେ' : 'Inside this application only'}</span></button></div>}{(captureMessage) && <p className="land-capture-message" role="status">{captureMessage}</p>}</dialog>

    <dialog className="land-dialog land-source-dialog" ref={sourceDialog} aria-labelledby="source-title"><div className="land-dialog-heading"><h2 id="source-title">{t.sourceWording}</h2><button className="land-dialog-close" aria-label="Close" onClick={() => sourceDialog.current?.close()}>×</button></div><pre>{sourceText}</pre></dialog>

    {selectingArea && <div className="land-selection-overlay" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setSelectionStart({ x: event.clientX, y: event.clientY }); setSelection({ x: event.clientX, y: event.clientY, width: 0, height: 0 }); }} onPointerMove={(event) => { if (!selectionStart) return; setSelection({ x: Math.min(selectionStart.x, event.clientX), y: Math.min(selectionStart.y, event.clientY), width: Math.abs(event.clientX - selectionStart.x), height: Math.abs(event.clientY - selectionStart.y) }); }} onPointerUp={(event) => { event.currentTarget.releasePointerCapture(event.pointerId); if (selection) finishAreaSelection(selection); setSelectionStart(null); }}><div className="land-selection-instruction">{lang === 'or' ? 'ଛବି ପାଇଁ ଅଂଶ ଟାଣି ବାଛନ୍ତୁ · Esc ବାତିଲ୍' : 'Drag to select an area · Esc to cancel'}</div>{selection && <div className="land-selection-box" style={{ left: selection.x, top: selection.y, width: selection.width, height: selection.height }} />}<button onClick={() => setSelectingArea(false)}>{lang === 'or' ? 'ବାତିଲ୍' : 'Cancel'}</button></div>}
  </div>;
}

