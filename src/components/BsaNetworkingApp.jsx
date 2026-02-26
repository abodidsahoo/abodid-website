import React, { useMemo, useState } from "react";
import "../styles/bsa-networking.css";

function normalizeQuery(text) {
  return (text || "").trim().toLowerCase();
}

const BsaNetworkingApp = ({
  topics = [],
  totalPeople = 0,
  topicCount = 0,
  location = "Manchester",
  timezone = "Europe/London",
}) => {
  const [selectedTopicIds, setSelectedTopicIds] = useState([]);
  const [topicQuery, setTopicQuery] = useState("");

  const normalizedTopicQuery = normalizeQuery(topicQuery);

  const topicMap = useMemo(() => {
    const map = new Map();
    for (const topic of topics) {
      map.set(topic.id, topic);
    }
    return map;
  }, [topics]);

  const filteredPills = useMemo(() => {
    if (!normalizedTopicQuery) {
      return topics;
    }

    return topics.filter((topic) => {
      const haystack = `${topic.label} ${topic.code || ""} ${topic.kind || ""}`.toLowerCase();
      return haystack.includes(normalizedTopicQuery);
    });
  }, [topics, normalizedTopicQuery]);

  const selectedTopics = useMemo(() => {
    return selectedTopicIds
      .map((id) => topicMap.get(id))
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [selectedTopicIds, topicMap]);

  const selectedTopicBlocks = useMemo(() => {
    return selectedTopics.map((topic) => ({
      ...topic,
      filteredPeople: topic.people || [],
    }));
  }, [selectedTopics]);

  const aggregatedPeople = useMemo(() => {
    const merged = new Set();

    for (const topic of selectedTopicBlocks) {
      for (const name of topic.filteredPeople) {
        merged.add(name);
      }
    }

    return Array.from(merged).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [selectedTopicBlocks]);

  const toggleTopic = (topicId) => {
    setSelectedTopicIds((current) => {
      if (current.includes(topicId)) {
        return current.filter((id) => id !== topicId);
      }
      return [...current, topicId];
    });
  };

  const selectAllFiltered = () => {
    setSelectedTopicIds((current) => {
      const set = new Set(current);
      for (const topic of filteredPills) {
        set.add(topic.id);
      }
      return Array.from(set);
    });
  };

  const clearSelection = () => {
    setSelectedTopicIds([]);
  };

  return (
    <div className="bsa-net-app">
      <header className="bsa-net-hero">
        <div className="bsa-net-hero-top">
          <div className="bsa-net-hero-title-wrap">
            <p className="bsa-net-eyebrow">BSA Conference Networking</p>
            <h1>Find People By Topic</h1>
          </div>
          <a className="bsa-net-page-link-btn" href="/bsa-schedule">
            Go to Schedule page
          </a>
        </div>
        <p className="bsa-net-intro">
          Select one or more topic pills.
          <br />
          Names are grouped by topic streams.
        </p>
        <div className="bsa-net-meta">
          <span>{topicCount || topics.length} topics</span>
          <span>{totalPeople} unique people</span>
          <span>
            {location} ({timezone})
          </span>
        </div>
      </header>

      <section className="bsa-net-controls" aria-label="Networking topic filters">
        <div className="bsa-net-control-row">
          <label htmlFor="bsa-topic-search">Search topics</label>
          <input
            id="bsa-topic-search"
            type="search"
            value={topicQuery}
            onChange={(event) => setTopicQuery(event.target.value)}
            placeholder="Search topic label or code"
            autoComplete="off"
          />
        </div>

        <div className="bsa-net-actions">
          <button type="button" onClick={selectAllFiltered} disabled={!filteredPills.length}>
            Select shown topics
          </button>
          <button type="button" onClick={clearSelection} disabled={!selectedTopicIds.length}>
            Clear
          </button>
        </div>

        <div className="bsa-net-pill-wrap" role="list" aria-label="Topic pills">
          {filteredPills.map((topic) => {
            const isActive = selectedTopicIds.includes(topic.id);
            return (
              <button
                type="button"
                key={topic.id}
                className={`bsa-net-pill ${isActive ? "is-active" : ""}`}
                onClick={() => toggleTopic(topic.id)}
                aria-pressed={isActive}
                role="listitem"
              >
                <span className="bsa-net-pill-label">{topic.label}</span>
                <span className="bsa-net-pill-count">{topic.count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bsa-net-results" aria-label="Networking result lists">
        {!selectedTopics.length ? (
          <p className="bsa-net-empty">
            Select a topic to see names. You can select multiple topics and the
            lists will aggregate below.
          </p>
        ) : (
          <>
            <div className="bsa-net-summary">
              <p>
                Selected topics: <strong>{selectedTopics.length}</strong>
              </p>
              <p>
                Aggregated names: <strong>{aggregatedPeople.length}</strong>
              </p>
            </div>

            {selectedTopicBlocks.length === 0 ? (
              <p className="bsa-net-empty">No names available for the selected topics.</p>
            ) : (
              selectedTopicBlocks.map((topic) => (
                <article key={`block-${topic.id}`} className="bsa-net-topic-block">
                  <header>
                    <h2>{topic.label}</h2>
                    <span>{topic.filteredPeople.length} names</span>
                  </header>
                  <ul>
                    {topic.filteredPeople.map((name) => (
                      <li key={`${topic.id}-${name}`}>{name}</li>
                    ))}
                  </ul>
                </article>
              ))
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default BsaNetworkingApp;
