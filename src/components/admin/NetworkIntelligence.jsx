import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDownUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Filter,
  LoaderCircle,
  Network,
  PanelRightOpen,
  Pin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Star,
  Upload,
  X,
} from "lucide-react";
import NetworkContactDrawer from "./NetworkContactDrawer";
import NetworkImportDialog from "./NetworkImportDialog";
import "./network-intelligence.css";

const LAYOUT_STORAGE_KEY = "network-intelligence-layout-v2";
const VIEW_STORAGE_KEY = "network-intelligence-saved-views-v1";
const CUSTOM_COLUMN_STORAGE_KEY = "network-intelligence-custom-columns-v1";

const DEFAULT_COLUMNS = [
  { key: "name", label: "Name", width: 220, minWidth: 180, visible: true, pinned: true },
  { key: "role", label: "Role", width: 230, minWidth: 175, visible: true, pinned: false },
  { key: "company", label: "Company", width: 250, minWidth: 185, visible: true, pinned: false },
  { key: "category", label: "Work category", width: 200, minWidth: 165, visible: true, pinned: false },
  { key: "email", label: "Email", width: 230, minWidth: 180, visible: true, pinned: false },
  { key: "relevance", label: "Relevance", width: 250, minWidth: 190, visible: true, pinned: false },
  { key: "tags", label: "Tags", width: 210, minWidth: 160, visible: false, pinned: false },
  { key: "linkedin", label: "Profile", width: 112, minWidth: 96, visible: false, pinned: false },
  { key: "connected", label: "Connected", width: 138, minWidth: 112, visible: true, pinned: false },
];

const EMPTY_FILTERS = {
  hasEmail: null,
  emailType: "",
  country: "",
  region: "",
  city: "",
  company: "",
  workCategories: [],
  expertiseKeywords: [],
  outreachGoals: [],
  relationshipTier: "",
  tags: [],
  verificationState: "",
  enrichmentStatus: "",
  newsletterStatus: "",
  doNotContact: null,
  connectedFrom: "",
  connectedTo: "",
  includeArchived: false,
};

const PRESETS = [
  {
    label: "Podcast",
    query: "Thoughtful podcast guests working across AI, education, culture or creative practice",
  },
  {
    label: "Jobs",
    query: "People at museums, universities or creative technology studios relevant to production roles",
  },
  {
    label: "SEO",
    query: "People working in technical SEO, content strategy, discoverability or image search",
  },
  {
    label: "Research",
    query: "Researchers across archives, photography, digital humanities and cultural heritage",
  },
];

const SORT_FOR_COLUMN = {
  name: ["name_asc", "name_desc"],
  company: ["company_asc", "company_asc"],
  connected: ["connected_desc", "connected_asc"],
  relevance: ["relevance", "relevance"],
};

const formatDate = (value) => {
  if (!value) return "Unknown";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
};

const formatDateTime = (value) => {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
};

const unique = (values) => [...new Set(values.filter(Boolean))];

const readLocalStorage = (key, fallback) => {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const writeLocalStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local persistence is helpful but never blocks the network tool.
  }
};

const mergeColumns = (storedColumns, customDefinitions) => {
  const customColumns = (customDefinitions || []).map((definition) => ({
    key: `custom:${definition.key}`,
    label: definition.label,
    width: 180,
    minWidth: 140,
    visible: true,
    pinned: false,
    custom: true,
  }));
  const baseline = [...DEFAULT_COLUMNS, ...customColumns];
  if (!Array.isArray(storedColumns)) return baseline;
  const legacyLayout = storedColumns.some((column) => (
    ["work", "location", "verification"].includes(column?.key)
  )) || !storedColumns.some((column) => column?.key === "role");
  if (legacyLayout) return baseline;

  const baselineByKey = new Map(baseline.map((column) => [column.key, column]));
  const restored = storedColumns
    .filter((column) => baselineByKey.has(column.key))
    .map((column) => ({
      ...baselineByKey.get(column.key),
      width: Number.isFinite(column.width)
        ? Math.max(baselineByKey.get(column.key).minWidth, column.width)
        : baselineByKey.get(column.key).width,
      visible: column.visible !== false,
      pinned: column.key === "name" ? column.pinned !== false : column.pinned === true,
    }));
  const restoredKeys = new Set(restored.map((column) => column.key));
  return [...restored, ...baseline.filter((column) => !restoredKeys.has(column.key))];
};

const countActiveFilters = (filters) => Object.entries(filters).reduce((count, [key, value]) => {
  if (key === "includeArchived") return count + (value ? 1 : 0);
  if (Array.isArray(value)) return count + (value.length ? 1 : 0);
  if (typeof value === "boolean") return count + 1;
  return count + (value ? 1 : 0);
}, 0);

const csvEscape = (value) => {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const cellValue = (contact, column) => {
  switch (column.key) {
    case "name":
      return contact.full_name || "Unknown connection";
    case "email":
      return contact.email || contact.source_email || "";
    case "role":
      return contact.position || contact.source_position || "";
    case "company":
      return contact.company || contact.source_company || "";
    case "category":
      return contact.work_categories || [];
    case "connected":
      return contact.connected_on || "";
    case "relevance":
      return contact.match_reason || "";
    case "tags":
      return contact.tags || [];
    case "linkedin":
      return contact.linkedin_url || "";
    default:
      return column.custom
        ? contact.custom_fields?.[column.key.replace(/^custom:/, "")] ?? ""
        : "";
  }
};

function TagList({ values, empty = "Unclassified" }) {
  const items = Array.isArray(values) ? values : [];
  if (!items.length) return <span className="ni-muted">{empty}</span>;
  return (
    <span className="ni-chip-list">
      {items.slice(0, 3).map((item) => <span className="ni-chip" key={item}>{item}</span>)}
      {items.length > 3 && <span className="ni-chip ni-chip-more">+{items.length - 3}</span>}
    </span>
  );
}

function ContactCell({ contact, column, openContact }) {
  const email = contact.email || contact.source_email;
  const company = contact.company || contact.source_company;
  const position = contact.position || contact.source_position;

  switch (column.key) {
    case "name":
      return (
        <button type="button" className="ni-name-button" onClick={openContact}>
          <span className="ni-name-line">
            {contact.starred && <Star size={12} fill="currentColor" aria-label="Starred" />}
            {contact.full_name || "Unknown connection"}
          </span>
        </button>
      );
    case "role":
      return (
        <span className="ni-single-line-cell" title={position || "Role unknown"}>
          {position || <span className="ni-muted">Role unknown</span>}
        </span>
      );
    case "company":
      return (
        <span className="ni-company-line" title={company || "Company unknown"}>
          {company || <span className="ni-muted">Company unknown</span>}
        </span>
      );
    case "email":
      return email
        ? <a className="ni-inline-link" href={`mailto:${email}`} onClick={(event) => event.stopPropagation()}>{email}</a>
        : <span className="ni-muted">No email</span>;
    case "category":
      return <TagList values={contact.work_categories} />;
    case "connected":
      return formatDate(contact.connected_on);
    case "relevance":
      return (
        <span className="ni-two-line-cell">
          <strong>{contact.match_reason || "Smart result"}</strong>
          <span>{Number.isFinite(contact.relevance_score)
            ? `${Math.max(0, Math.min(100, Math.round(contact.relevance_score * 100)))}% signal`
            : "Ranked from profile context"}</span>
        </span>
      );
    case "tags":
      return <TagList values={contact.tags} empty="No tags" />;
    case "linkedin":
      return contact.linkedin_url
        ? <a className="ni-inline-link" href={contact.linkedin_url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Open</a>
        : <span className="ni-muted">Missing</span>;
    default:
      return String(cellValue(contact, column) || "") || <span className="ni-muted">Empty</span>;
  }
}

export default function NetworkIntelligence({ accessToken }) {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState("relevance");
  const [page, setPage] = useState(1);
  const [smartActive, setSmartActive] = useState(false);
  const [smartInterpretation, setSmartInterpretation] = useState(null);
  const [searchNonce, setSearchNonce] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [drawerContactId, setDrawerContactId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [savedViews, setSavedViews] = useState([]);
  const [customDefinitions, setCustomDefinitions] = useState([]);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [draggingColumnKey, setDraggingColumnKey] = useState("");
  const [columnDropTarget, setColumnDropTarget] = useState(null);
  const [indexState, setIndexState] = useState({ running: false, processed: 0, remaining: 0, error: "" });
  const [discoverySeeds, setDiscoverySeeds] = useState({});
  const dragColumnKey = useRef(null);
  const indexCancelled = useRef(false);

  const authenticatedFetch = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(
      new Error(payload.error || `Request failed with ${response.status}.`),
      { payload, status: response.status },
    );
    return payload;
  };

  useEffect(() => {
    const definitions = readLocalStorage(CUSTOM_COLUMN_STORAGE_KEY, []);
    const storedColumns = readLocalStorage(LAYOUT_STORAGE_KEY, null);
    setCustomDefinitions(Array.isArray(definitions) ? definitions : []);
    setColumns(mergeColumns(storedColumns, definitions));
    setSavedViews(readLocalStorage(VIEW_STORAGE_KEY, []));
  }, []);

  useEffect(() => {
    writeLocalStorage(LAYOUT_STORAGE_KEY, columns.map((column) => ({
      key: column.key,
      width: column.width,
      visible: column.visible,
      pinned: column.pinned,
    })));
  }, [columns]);

  const loadFacets = async () => {
    if (!accessToken) return;
    try {
      const data = await authenticatedFetch("/api/admin/network/facets");
      setFacets(data);
      setSetupRequired(false);
    } catch (requestError) {
      if (requestError.payload?.setupRequired) setSetupRequired(true);
    }
  };

  useEffect(() => {
    loadFacets();
  }, [accessToken, refreshKey]);

  useEffect(() => {
    if (!accessToken) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const body = {
          query,
          filters,
          page,
          pageSize: 100,
          sort,
          smart: smartActive,
        };
        const data = smartActive
          ? await authenticatedFetch("/api/admin/network/contacts", {
              method: "POST",
              body: JSON.stringify(body),
              signal: controller.signal,
            })
          : await authenticatedFetch(
              `/api/admin/network/contacts?query=${encodeURIComponent(query)}&filters=${encodeURIComponent(JSON.stringify(filters))}&page=${page}&pageSize=100&sort=${encodeURIComponent(sort)}`,
              { signal: controller.signal },
            );
        setContacts(data.contacts || []);
        setTotal(data.total || 0);
        setSmartInterpretation(data.interpretation || null);
        setSetupRequired(false);
      } catch (requestError) {
        if (requestError.name === "AbortError") return;
        setSetupRequired(Boolean(requestError.payload?.setupRequired));
        setError(requestError.message);
        setContacts([]);
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, smartActive ? 0 : 240);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [accessToken, query, filters, page, sort, smartActive, searchNonce, refreshKey]);

  useEffect(() => {
    setSelectedIds((current) => {
      const pageIds = new Set(contacts.map((contact) => contact.id));
      return new Set([...current].filter((id) => pageIds.has(id)));
    });
  }, [contacts]);

  const visibleColumns = useMemo(() => {
    const available = columns.filter(
      (column) => column.visible && (column.key !== "relevance" || smartActive),
    );
    const connectedColumn = available.find((column) => column.key === "connected");
    return [
      ...available.filter((column) => column.key !== "connected"),
      ...(connectedColumn ? [connectedColumn] : []),
    ];
  }, [columns, smartActive]);

  const pinnedOffsets = useMemo(() => {
    let left = 44;
    const offsets = {};
    for (const column of visibleColumns) {
      if (!column.pinned) continue;
      offsets[column.key] = left;
      left += column.width;
    }
    return offsets;
  }, [visibleColumns]);

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedIds.has(contact.id)),
    [contacts, selectedIds],
  );

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setSmartActive(false);
  };

  const clearAll = () => {
    setQuery("");
    setFilters(EMPTY_FILTERS);
    setSort("relevance");
    setPage(1);
    setSmartActive(false);
    setSmartInterpretation(null);
  };

  const runSmartSearch = () => {
    if (!query.trim()) return;
    setSmartActive(true);
    setPage(1);
    setSearchNonce((value) => value + 1);
  };

  const applyPreset = (preset) => {
    setQuery(preset.query);
    setPage(1);
    setSmartActive(true);
    setSearchNonce((value) => value + 1);
  };

  const toggleSelected = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const allSelected = contacts.length && contacts.every((contact) => selectedIds.has(contact.id));
    setSelectedIds(allSelected ? new Set() : new Set(contacts.map((contact) => contact.id)));
  };

  const handleSort = (columnKey) => {
    const options = SORT_FOR_COLUMN[columnKey];
    if (!options) return;
    setSort((current) => current === options[0] ? options[1] : options[0]);
    setPage(1);
  };

  const startResize = (event, columnKey) => {
    event.preventDefault();
    event.stopPropagation();
    const column = columns.find((item) => item.key === columnKey);
    if (!column) return;
    const startX = event.clientX;
    const startWidth = column.width;
    const handleMove = (moveEvent) => {
      const width = Math.max(column.minWidth, startWidth + moveEvent.clientX - startX);
      setColumns((current) => current.map((item) => (
        item.key === columnKey ? { ...item, width } : item
      )));
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  };

  const getColumnDropPosition = (event, targetKey) => {
    if (targetKey === "connected") return "before";
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientX < bounds.left + bounds.width / 2 ? "before" : "after";
  };

  const handleColumnDragOver = (event, targetKey) => {
    event.preventDefault();
    const sourceKey = dragColumnKey.current;
    if (!sourceKey || sourceKey === targetKey) {
      setColumnDropTarget(null);
      return;
    }
    event.dataTransfer.dropEffect = "move";
    const position = getColumnDropPosition(event, targetKey);
    setColumnDropTarget((current) => (
      current?.key === targetKey && current.position === position
        ? current
        : { key: targetKey, position }
    ));
  };

  const clearColumnDrag = () => {
    dragColumnKey.current = null;
    setDraggingColumnKey("");
    setColumnDropTarget(null);
  };

  const dropColumn = (targetKey, position) => {
    const sourceKey = dragColumnKey.current;
    clearColumnDrag();
    if (!sourceKey || sourceKey === targetKey) return;
    setColumns((current) => {
      const next = [...current];
      const sourceIndex = next.findIndex((column) => column.key === sourceKey);
      if (sourceIndex < 0) return current;
      const [moved] = next.splice(sourceIndex, 1);
      const targetIndex = next.findIndex((column) => column.key === targetKey);
      if (targetIndex < 0) return current;
      const insertAt = position === "after" ? targetIndex + 1 : targetIndex;
      next.splice(insertAt, 0, moved);
      return next;
    });
  };

  const addCustomColumn = () => {
    const label = window.prompt("Custom column name");
    if (!label?.trim()) return;
    const baseKey = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `field_${Date.now()}`;
    const existingKeys = new Set(customDefinitions.map((item) => item.key));
    let key = baseKey;
    let suffix = 2;
    while (existingKeys.has(key)) {
      key = `${baseKey}_${suffix}`;
      suffix += 1;
    }
    const nextDefinitions = [...customDefinitions, { key, label: label.trim().slice(0, 80), type: "text" }];
    setCustomDefinitions(nextDefinitions);
    writeLocalStorage(CUSTOM_COLUMN_STORAGE_KEY, nextDefinitions);
    setColumns((current) => [...current, {
      key: `custom:${key}`,
      label: label.trim().slice(0, 80),
      width: 180,
      minWidth: 140,
      visible: true,
      pinned: false,
      custom: true,
    }]);
  };

  const resetColumns = () => {
    setColumns(mergeColumns(null, customDefinitions));
  };

  const saveCurrentView = () => {
    const name = window.prompt("Saved view name");
    if (!name?.trim()) return;
    const next = [
      ...savedViews,
      {
        id: crypto.randomUUID(),
        name: name.trim().slice(0, 80),
        query,
        filters,
        sort,
        columns,
        smartActive,
      },
    ].slice(-20);
    setSavedViews(next);
    writeLocalStorage(VIEW_STORAGE_KEY, next);
  };

  const loadSavedView = (viewId) => {
    const view = savedViews.find((item) => item.id === viewId);
    if (!view) return;
    setQuery(view.query || "");
    setFilters({ ...EMPTY_FILTERS, ...(view.filters || {}) });
    setSort(view.sort || "relevance");
    setColumns(mergeColumns(view.columns, customDefinitions));
    setSmartActive(Boolean(view.smartActive));
    setPage(1);
    setSearchNonce((value) => value + 1);
  };

  const patchSelected = async (field) => {
    if (!selectedContacts.length) return;
    const label = field === "tags" ? "tag" : "work category";
    const value = window.prompt(`Add ${label} to ${selectedContacts.length} selected contact${selectedContacts.length === 1 ? "" : "s"}`);
    if (!value?.trim()) return;

    try {
      await Promise.all(selectedContacts.map((contact) => authenticatedFetch(
        `/api/admin/network/contacts/${contact.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            [field]: unique([...(contact[field] || []), value.trim()]),
          }),
        },
      )));
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const exportSelected = () => {
    if (!selectedContacts.length) return;
    const exportColumns = visibleColumns.filter((column) => column.key !== "relevance");
    const csv = [
      exportColumns.map((column) => csvEscape(column.label)).join(","),
      ...selectedContacts.map((contact) => exportColumns
        .map((column) => csvEscape(cellValue(contact, column)))
        .join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `network-shortlist-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const enrichSelected = async () => {
    if (!selectedContacts.length) return;
    if (selectedContacts.length > 3) {
      setError("Public discovery is limited to three selected contacts at a time.");
      return;
    }
    setError("");
    const seeds = {};
    try {
      for (const contact of selectedContacts) {
        seeds[contact.id] = await authenticatedFetch("/api/admin/network/discover", {
          method: "POST",
          body: JSON.stringify({ contactId: contact.id }),
        });
      }
      setDiscoverySeeds((current) => ({ ...current, ...seeds }));
      setDrawerContactId(selectedContacts[0].id);
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const runSemanticIndex = async () => {
    if (indexState.running) {
      indexCancelled.current = true;
      return;
    }
    indexCancelled.current = false;
    setIndexState({
      running: true,
      processed: 0,
      remaining: Number(facets?.pendingEmbeddings || 0),
      error: "",
    });
    let processedTotal = 0;
    try {
      while (!indexCancelled.current) {
        const result = await authenticatedFetch("/api/admin/network/reembed", {
          method: "POST",
          body: JSON.stringify({ batchSize: 64 }),
        });
        processedTotal += Number(result.processed || 0);
        setIndexState({
          running: true,
          processed: processedTotal,
          remaining: Number(result.remaining || 0),
          error: "",
        });
        if (result.complete || !result.processed) break;
      }
      setIndexState((current) => ({ ...current, running: false }));
      loadFacets();
    } catch (requestError) {
      setIndexState((current) => ({
        ...current,
        running: false,
        error: requestError.message,
      }));
    }
  };

  const onImported = () => {
    setRefreshKey((current) => current + 1);
    setPage(1);
  };

  const allVisibleSelected = contacts.length > 0
    && contacts.every((contact) => selectedIds.has(contact.id));
  const pageCount = Math.max(1, Math.ceil(total / 100));
  const activeFilterCount = countActiveFilters(filters);
  const gridTemplateColumns = `44px ${visibleColumns.map((column) => `${column.width}px`).join(" ")}`;

  return (
    <section className="network-intelligence" aria-label="Network Intelligence">
      <header className="ni-utility-bar">
        <div className="ni-title-block">
          <span className="ni-title-icon" aria-hidden="true"><Network size={19} /></span>
          <div>
            <h2>Network intelligence</h2>
            <p>
              {facets?.total?.toLocaleString?.() || total.toLocaleString()} private contacts
              {facets?.lastImport?.completed_at
                ? ` · synced ${formatDateTime(facets.lastImport.completed_at)}`
                : " · no completed import"}
            </p>
          </div>
        </div>

        <div className="ni-utility-actions">
          {Number(facets?.pendingEmbeddings || 0) > 0 || indexState.running ? (
            <button
              type="button"
              className={`ni-button ni-button-quiet ${indexState.running ? "is-working" : ""}`}
              onClick={runSemanticIndex}
              title="Build or refresh semantic search vectors in private batches"
            >
              {indexState.running
                ? <LoaderCircle size={15} className="ni-spin" />
                : <Sparkles size={15} />}
              {indexState.running
                ? `${indexState.processed.toLocaleString()} indexed · stop`
                : `Index ${Number(facets?.pendingEmbeddings || 0).toLocaleString()}`}
            </button>
          ) : null}
          <button type="button" className="ni-button ni-button-quiet" onClick={() => setShowColumns((open) => !open)}>
            <Settings2 size={15} />
            Columns
          </button>
          <button type="button" className="ni-button ni-button-primary" onClick={() => setShowImport(true)}>
            <Upload size={15} />
            Import / update CSV
          </button>
        </div>

        {showColumns && (
          <div className="ni-popover ni-column-popover">
            <div className="ni-popover-heading">
              <strong>Columns</strong>
              <button type="button" aria-label="Close columns" onClick={() => setShowColumns(false)}><X size={15} /></button>
            </div>
            <p>Drag headers to reorder. Resize from the right edge.</p>
            <div className="ni-column-list">
              {columns.map((column) => (
                <div className="ni-column-control" key={column.key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={column.visible}
                      onChange={() => setColumns((current) => current.map((item) => (
                        item.key === column.key ? { ...item, visible: !item.visible } : item
                      )))}
                    />
                    <span>{column.label}</span>
                  </label>
                  <button
                    type="button"
                    className={column.pinned ? "is-active" : ""}
                    aria-label={`${column.pinned ? "Unpin" : "Pin"} ${column.label}`}
                    title={`${column.pinned ? "Unpin" : "Pin"} ${column.label}`}
                    onClick={() => setColumns((current) => current.map((item) => (
                      item.key === column.key ? { ...item, pinned: !item.pinned } : item
                    )))}
                  >
                    <Pin size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="ni-popover-footer">
              <button type="button" onClick={addCustomColumn}><Plus size={14} /> Custom field</button>
              <button type="button" onClick={resetColumns}><RefreshCw size={14} /> Reset</button>
            </div>
          </div>
        )}
      </header>

      <div className="ni-search-shell">
        <div className="ni-search-row">
          <label className="ni-search-input">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Search contacts</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
                setSmartActive(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  runSmartSearch();
                }
              }}
              placeholder="Search a name, company, role, email — or describe who you need"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setSmartActive(false);
                }}
              >
                <X size={15} />
              </button>
            )}
          </label>
          <button
            type="button"
            className={`ni-smart-button ${smartActive ? "is-active" : ""}`}
            onClick={runSmartSearch}
            disabled={!query.trim() || loading}
          >
            {smartActive && loading ? <LoaderCircle size={15} className="ni-spin" /> : <Sparkles size={15} />}
            Smart relevance
          </button>
          <button
            type="button"
            className={`ni-filter-button ${showFilters || activeFilterCount ? "is-active" : ""}`}
            onClick={() => setShowFilters((open) => !open)}
          >
            <Filter size={15} />
            Filters
            {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
          </button>
          <button
            type="button"
            className={`ni-email-toggle ${filters.hasEmail === true ? "is-active" : ""}`}
            onClick={() => updateFilter("hasEmail", filters.hasEmail === true ? null : true)}
          >
            <span className="ni-toggle-track"><span /></span>
            Email only
          </button>
        </div>

        <div className="ni-search-meta">
          <div className="ni-presets" aria-label="Goal presets">
            {PRESETS.map((preset) => (
              <button type="button" key={preset.label} onClick={() => applyPreset(preset)}>
                {preset.label}
              </button>
            ))}
          </div>
          <div className="ni-view-actions">
            <select defaultValue="" onChange={(event) => {
              loadSavedView(event.target.value);
              event.target.value = "";
            }}>
              <option value="" disabled>Saved views</option>
              {savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
            </select>
            <button type="button" onClick={saveCurrentView} title="Save this search and layout"><Save size={14} /> Save view</button>
            {(query || activeFilterCount > 0) && <button type="button" onClick={clearAll}>Clear all</button>}
          </div>
        </div>

        {smartInterpretation && (
          <div className="ni-smart-context">
            <Sparkles size={14} />
            <span>
              Ranking for <strong>{smartInterpretation.semanticConcept || query}</strong>
              {smartInterpretation.warning ? ` · ${smartInterpretation.warning}` : ""}
            </span>
          </div>
        )}
      </div>

      {showFilters && (
        <div className="ni-filter-panel">
          <label>
            <span>Email</span>
            <select
              value={filters.hasEmail === null ? "" : String(filters.hasEmail)}
              onChange={(event) => updateFilter(
                "hasEmail",
                event.target.value === "" ? null : event.target.value === "true",
              )}
            >
              <option value="">Any</option>
              <option value="true">Has email</option>
              <option value="false">No email</option>
            </select>
          </label>
          <label>
            <span>Email type</span>
            <select value={filters.emailType} onChange={(event) => updateFilter("emailType", event.target.value)}>
              <option value="">Any</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label>
            <span>Company</span>
            <input value={filters.company} onChange={(event) => updateFilter("company", event.target.value)} placeholder="Contains…" list="ni-companies" />
            <datalist id="ni-companies">
              {(facets?.companies || []).map((item) => <option key={item.value} value={item.value} />)}
            </datalist>
          </label>
          <label>
            <span>Country</span>
            <input value={filters.country} onChange={(event) => updateFilter("country", event.target.value)} placeholder="Country" list="ni-countries" />
            <datalist id="ni-countries">
              {(facets?.countries || []).filter((item) => item.value !== "Unknown").map((item) => <option key={item.value} value={item.value} />)}
            </datalist>
          </label>
          <label>
            <span>City</span>
            <input value={filters.city} onChange={(event) => updateFilter("city", event.target.value)} placeholder="City" list="ni-cities" />
            <datalist id="ni-cities">
              {(facets?.cities || []).filter((item) => item.value !== "Unknown").map((item) => <option key={item.value} value={item.value} />)}
            </datalist>
          </label>
          <label>
            <span>Work category</span>
            <select
              value={filters.workCategories[0] || ""}
              onChange={(event) => updateFilter("workCategories", event.target.value ? [event.target.value] : [])}
            >
              <option value="">Any</option>
              {(facets?.categories || []).map((item) => <option key={item.value} value={item.value}>{item.value} ({item.count})</option>)}
            </select>
          </label>
          <label>
            <span>Relationship</span>
            <select value={filters.relationshipTier} onChange={(event) => updateFilter("relationshipTier", event.target.value)}>
              <option value="">Any</option>
              <option value="unrated">Unrated</option>
              <option value="weak">Weak</option>
              <option value="familiar">Familiar</option>
              <option value="strong">Strong</option>
            </select>
          </label>
          <label>
            <span>Outreach goal</span>
            <select
              value={filters.outreachGoals[0] || ""}
              onChange={(event) => updateFilter("outreachGoals", event.target.value ? [event.target.value] : [])}
            >
              <option value="">Any</option>
              {["Podcast", "Jobs", "SEO", "Research", "Collaboration"].map((goal) => <option key={goal}>{goal}</option>)}
            </select>
          </label>
          <label>
            <span>Data quality</span>
            <select value={filters.verificationState} onChange={(event) => updateFilter("verificationState", event.target.value)}>
              <option value="">Any</option>
              <option value="verified">Verified</option>
              <option value="probable">Probable</option>
              <option value="ambiguous">Ambiguous</option>
              <option value="stale">Stale</option>
              <option value="source_only">Source only</option>
            </select>
          </label>
          <label>
            <span>Newsletter</span>
            <select value={filters.newsletterStatus} onChange={(event) => updateFilter("newsletterStatus", event.target.value)}>
              <option value="">Any consent state</option>
              <option value="not_subscribed">Not subscribed</option>
              <option value="subscribed">Subscribed</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label>
            <span>Connected from</span>
            <input type="date" value={filters.connectedFrom} onChange={(event) => updateFilter("connectedFrom", event.target.value)} />
          </label>
          <label>
            <span>Connected to</span>
            <input type="date" value={filters.connectedTo} onChange={(event) => updateFilter("connectedTo", event.target.value)} />
          </label>
          <label className="ni-filter-check">
            <input
              type="checkbox"
              checked={filters.doNotContact === true}
              onChange={(event) => updateFilter("doNotContact", event.target.checked ? true : null)}
            />
            <span>Do not contact only</span>
          </label>
          <label className="ni-filter-check">
            <input
              type="checkbox"
              checked={filters.includeArchived}
              onChange={(event) => updateFilter("includeArchived", event.target.checked)}
            />
            <span>Include archived</span>
          </label>
        </div>
      )}

      {indexState.error && <div className="ni-alert ni-alert-error">{indexState.error}</div>}
      {error && <div className="ni-alert ni-alert-error">{error}</div>}
      {setupRequired && (
        <div className="ni-setup-state">
          <Network size={23} />
          <div>
            <strong>Supabase setup is ready to apply</strong>
            <p>The private schema and search functions are included in the new migration. No public contact query is enabled.</p>
          </div>
        </div>
      )}

      <div className="ni-grid-shell">
        {selectedIds.size > 0 && (
          <div className="ni-bulk-strip">
            <strong>{selectedIds.size} selected</strong>
            <button type="button" onClick={() => patchSelected("tags")}>Tag</button>
            <button type="button" onClick={() => patchSelected("work_categories")}>Classify</button>
            <button type="button" onClick={exportSelected}><Download size={14} /> Export shortlist</button>
            <button type="button" onClick={enrichSelected}><Sparkles size={14} /> Find public work</button>
            <button type="button" className="ni-bulk-clear" onClick={() => setSelectedIds(new Set())}><X size={14} /> Clear</button>
          </div>
        )}

        <div className="ni-grid-scroll" role="region" aria-label="Network contacts table" tabIndex={0}>
          <div className="ni-grid ni-grid-header" style={{ gridTemplateColumns }}>
            <div className="ni-cell ni-select-cell is-pinned" style={{ "--ni-left": "0px" }}>
              <input
                type="checkbox"
                aria-label="Select all visible contacts"
                checked={Boolean(allVisibleSelected)}
                onChange={toggleAllVisible}
              />
            </div>
            {visibleColumns.map((column) => (
              <div
                key={column.key}
                className={`ni-cell ni-header-cell ${column.pinned ? "is-pinned" : ""} ${
                  draggingColumnKey === column.key ? "is-dragging" : ""
                } ${
                  columnDropTarget?.key === column.key
                    ? `is-drop-${columnDropTarget.position}`
                    : ""
                }`}
                style={column.pinned ? { "--ni-left": `${pinnedOffsets[column.key]}px` } : undefined}
                draggable={column.key !== "connected"}
                onDragStart={(event) => {
                  if (column.key === "connected") return;
                  dragColumnKey.current = column.key;
                  setDraggingColumnKey(column.key);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", column.key);
                }}
                onDragEnd={clearColumnDrag}
                onDragOver={(event) => handleColumnDragOver(event, column.key)}
                onDrop={(event) => {
                  event.preventDefault();
                  dropColumn(
                    column.key,
                    getColumnDropPosition(event, column.key),
                  );
                }}
              >
                <button
                  type="button"
                  disabled={!SORT_FOR_COLUMN[column.key]}
                  onClick={() => handleSort(column.key)}
                >
                  {column.label}
                  {SORT_FOR_COLUMN[column.key] && <ArrowDownUp size={12} />}
                </button>
                {column.pinned && <Pin size={11} className="ni-pin-mark" />}
                <span
                  className="ni-resize-handle"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize ${column.label}`}
                  onPointerDown={(event) => startResize(event, column.key)}
                />
              </div>
            ))}
          </div>

          {loading && contacts.length === 0 ? (
            <div className="ni-grid-state"><LoaderCircle className="ni-spin" size={20} /> Loading contacts…</div>
          ) : contacts.length === 0 ? (
            <div className="ni-grid-state">
              <Search size={21} />
              <strong>{setupRequired ? "Awaiting database setup" : "No contacts match this view"}</strong>
              <span>{setupRequired ? "Apply the included migration, then import Connections.csv." : "Clear filters or try a broader search."}</span>
            </div>
          ) : contacts.map((contact) => (
            <div
              key={contact.id}
              className={`ni-grid ni-grid-row ${selectedIds.has(contact.id) ? "is-selected" : ""}`}
              style={{ gridTemplateColumns }}
              onDoubleClick={() => setDrawerContactId(contact.id)}
            >
              <div className="ni-cell ni-select-cell is-pinned" style={{ "--ni-left": "0px" }}>
                <input
                  type="checkbox"
                  aria-label={`Select ${contact.full_name}`}
                  checked={selectedIds.has(contact.id)}
                  onChange={() => toggleSelected(contact.id)}
                />
              </div>
              {visibleColumns.map((column) => (
                <div
                  className={`ni-cell ${column.pinned ? "is-pinned" : ""}`}
                  key={column.key}
                  style={column.pinned ? { "--ni-left": `${pinnedOffsets[column.key]}px` } : undefined}
                >
                  <ContactCell
                    contact={contact}
                    column={column}
                    openContact={() => setDrawerContactId(contact.id)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <footer className="ni-grid-footer">
          <span>
            {total
              ? `${((page - 1) * 100 + 1).toLocaleString()}–${Math.min(page * 100, total).toLocaleString()} of ${total.toLocaleString()}`
              : "0 contacts"}
            {loading && contacts.length > 0 && <LoaderCircle size={13} className="ni-spin" />}
          </span>
          <div>
            <button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft size={15} />
            </button>
            <span>Page {page} of {pageCount}</span>
            <button type="button" aria-label="Next page" disabled={page >= pageCount || loading} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
              <ChevronRight size={15} />
            </button>
          </div>
        </footer>
      </div>

      <NetworkContactDrawer
        contactId={drawerContactId}
        accessToken={accessToken}
        customDefinitions={customDefinitions}
        initialDiscovery={drawerContactId ? discoverySeeds[drawerContactId] : null}
        onClose={() => setDrawerContactId(null)}
        onChanged={() => setRefreshKey((current) => current + 1)}
      />

      <NetworkImportDialog
        open={showImport}
        accessToken={accessToken}
        onClose={() => setShowImport(false)}
        onImported={onImported}
      />
    </section>
  );
}
