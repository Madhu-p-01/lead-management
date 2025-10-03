"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import supabase from "../utils/supabase";

const formatDateForDatabase = (date) => {
  if (!date) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const coerceCompetitors = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return `${value}`
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeLead = (lead) => ({
  ...lead,
  competitors: coerceCompetitors(lead.competitors),
  follow_up_date: lead.follow_up_date ? new Date(lead.follow_up_date) : null,
});

const statusVariants = {
  Interested: "border-emerald-200 bg-emerald-100 text-emerald-700",
  "Not Interested": "border-gray-200 bg-gray-100 text-gray-600",
  "Follow-up": "border-blue-200 bg-blue-100 text-blue-700",
  default: "border-gray-200 bg-gray-100 text-gray-600",
};

const getStatusClasses = (status) => statusVariants[status] || statusVariants.default;

const LeadList = ({ categoryId }) => {
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState({});

  useEffect(() => {
    if (!categoryId) {
      setLeads([]);
      return;
    }

    const fetchLeads = async () => {
      setIsLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("leads")
        .select(
          `
            id,
            name,
            reviews,
            rating,
            competitors,
            website,
            phone,
            owner_name,
            status,
            follow_up_date,
            notes,
            created_at,
            lead_categories!inner ( category_id )
          `
        )
        .eq("lead_categories.category_id", Number(categoryId))
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching leads", error);
        setErrorMessage("Unable to load leads for this category right now.");
        setLeads([]);
        setIsLoading(false);
        return;
      }

      const normalized = (data || []).map((lead) => normalizeLead(lead));

      setLeads(normalized);
      setIsLoading(false);
    };

    fetchLeads();
  }, [categoryId]);

  const setSavingState = (leadId, state) => {
    setSaving((prev) => ({
      ...prev,
      [leadId]: state,
    }));
  };

  const updateLead = async (leadId, updates) => {
    setSavingState(leadId, true);
    setErrorMessage("");

    const payload = { ...updates, updated_at: new Date().toISOString() };

    if (Object.prototype.hasOwnProperty.call(payload, "follow_up_date")) {
      payload.follow_up_date = payload.follow_up_date
        ? formatDateForDatabase(payload.follow_up_date)
        : null;
    }

    const { data, error } = await supabase
      .from("leads")
      .update(payload)
      .eq("id", leadId)
      .select()
      .single();

    if (error) {
      console.error("Failed to update lead", error);
      setErrorMessage("Failed to update lead. Please try again.");
      setSavingState(leadId, false);
      return;
    }

    if (data) {
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? normalizeLead({ ...lead, ...data }) : lead
        )
      );
    }

    setSavingState(leadId, false);
  };

  const handleStatusChange = (leadId, status) => {
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              status,
              follow_up_date: status === "Follow-up" ? lead.follow_up_date : null,
            }
          : lead
      )
    );

    const updates = { status };

    if (status !== "Follow-up") {
      updates.follow_up_date = null;
    }

    updateLead(leadId, updates);
  };

  const handleFollowUpDateChange = (leadId, date) => {
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, follow_up_date: date } : lead
      )
    );

    updateLead(leadId, { follow_up_date: date });
  };

  const handleNotesChange = (leadId, value) => {
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, notes: value } : lead
      )
    );
  };

  const handleNotesBlur = (leadId, value) => {
    updateLead(leadId, { notes: value });
  };

  if (!categoryId) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-300 bg-white/50 p-10 text-center text-sm text-gray-600 shadow-sm">
        Select a category to see its leads.
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">Leads</h2>
          {isLoading && <span className="text-sm text-gray-500">Loading...</span>}
        </div>
        <p className="text-sm text-gray-500">
          {leads.length === 0 && !isLoading
            ? "No leads have been added to this category yet."
            : `Managing ${leads.length} lead${leads.length === 1 ? "" : "s"}.`}
        </p>
        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {leads.map((lead) => {
          const statusClasses = getStatusClasses(lead.status);
          const competitors = Array.isArray(lead.competitors) ? lead.competitors : [];

          return (
            <article
              key={lead.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{lead.name}</h3>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses}`}
                    >
                      {lead.status || "Interested"}
                    </span>
                    {saving[lead.id] && (
                      <span className="text-xs text-gray-400">Saving...</span>
                    )}
                  </div>

                  <div className="grid gap-4 text-sm text-gray-600 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium text-gray-800">Phone:</span> {lead.phone || "-"}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Website:</span>{" "}
                        {lead.website ? (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {lead.website}
                          </a>
                        ) : (
                          "-"
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Owner:</span> {lead.owner_name || "-"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="font-medium text-gray-800">Rating:</span> {lead.rating ?? "-"}
                        {lead.reviews ? ` - ${lead.reviews} reviews` : ""}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Added:</span>{" "}
                        {lead.created_at
                          ? new Date(lead.created_at).toLocaleDateString()
                          : "-"}
                      </div>
                      {competitors.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-medium text-gray-800">Competitors:</span>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {competitors.map((competitor, index) => (
                              <span
                                key={`${lead.id}-competitor-${index}`}
                                className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600"
                              >
                                {competitor}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-xs space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-800" htmlFor={`status-${lead.id}`}>
                      Status
                    </label>
                    <select
                      id={`status-${lead.id}`}
                      value={lead.status || "Interested"}
                      onChange={(event) => handleStatusChange(lead.id, event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="Interested">Interested</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Follow-up">Follow-up</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-800">Follow-up</label>
                    <DatePicker
                      selected={lead.follow_up_date}
                      onChange={(date) => handleFollowUpDateChange(lead.id, date)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholderText="Select date"
                      dateFormat="MMM d, yyyy"
                      isClearable
                    />
                    <p className="text-xs text-gray-400">
                      Set a follow-up date to keep this conversation moving.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-2 border-t border-gray-100 pt-4">
                <label className="text-sm font-semibold text-gray-800" htmlFor={`notes-${lead.id}`}>
                  Notes
                </label>
                <textarea
                  id={`notes-${lead.id}`}
                  value={lead.notes || ""}
                  onChange={(event) => handleNotesChange(lead.id, event.target.value)}
                  onBlur={(event) => handleNotesBlur(lead.id, event.target.value)}
                  placeholder="Capture key moments, questions, or next steps."
                  className="h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default LeadList;
