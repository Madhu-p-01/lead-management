"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import supabase from "../utils/supabase";

const formatDateForDatabase = (date) => {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const LeadDetailModal = ({ lead, isOpen, onClose, onUpdate }) => {
  const [editedLead, setEditedLead] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (lead) {
      setEditedLead(lead);
    }
  }, [lead]);

  if (!isOpen || !lead || !editedLead) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const payload = {
      status: editedLead.status,
      follow_up_date: editedLead.follow_up_date
        ? formatDateForDatabase(editedLead.follow_up_date)
        : null,
      notes: editedLead.notes,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("leads")
      .update(payload)
      .eq("id", lead.id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update lead", error);
      setErrorMessage("Failed to update lead. Please try again.");
      setIsSaving(false);
      return;
    }

    if (data) {
      setSuccessMessage("Lead updated successfully!");
      setIsSaving(false);

      if (onUpdate) {
        onUpdate({
          ...data,
          follow_up_date: data.follow_up_date
            ? new Date(data.follow_up_date)
            : null,
        });
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  const handleClose = () => {
    setErrorMessage("");
    setSuccessMessage("");
    onClose();
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${lead.name}"? This action cannot be undone.`
    );

    if (!confirmDelete) return;
    setIsDeleting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error: junctionError } = await supabase
        .from("lead_categories")
        .delete()
        .eq("lead_id", lead.id);

      if (junctionError) {
        throw new Error(
          `Failed to delete lead associations: ${junctionError.message}`
        );
      }

      const { error: leadError } = await supabase
        .from("leads")
        .delete()
        .eq("id", lead.id);

      if (leadError) {
        throw new Error(`Failed to delete lead: ${leadError.message}`);
      }

      setSuccessMessage("Lead deleted successfully!");

      setTimeout(() => {
        onClose();
        if (onUpdate) {
          onUpdate(null);
        }
      }, 1000);
    } catch (error) {
      console.error("Delete lead error", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to delete lead. Please try again."
      );
      setIsDeleting(false);
    }
  };

  const handleCallPhone = () => {
    if (lead.phone) {
      window.location.href = `tel:${lead.phone}`;
    }
  };

  const handleVisitWebsite = () => {
    if (lead.website) {
      window.open(lead.website, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyPhone = () => {
    if (lead.phone) {
      navigator.clipboard.writeText(lead.phone);
      setSuccessMessage("Phone number copied!");
      setTimeout(() => setSuccessMessage(""), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="h-full w-full overflow-hidden bg-white shadow-xl sm:h-auto sm:max-w-2xl sm:rounded-lg animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl truncate pr-2">{lead.name}</h2>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            disabled={isSaving || isDeleting}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100vh-120px)] overflow-y-auto p-4 sm:max-h-[calc(100vh-200px)] sm:p-6">
          <div className="space-y-6">
            {/* Contact Information */}
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Full name
                </label>
                <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {lead.name}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {lead.phone || "—"}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Owner
                </label>
                <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {lead.owner_name || "—"}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Rating
                </label>
                <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {lead.rating ? `${lead.rating} ⭐ ${lead.reviews ? `(${lead.reviews})` : ''}` : "—"}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Website
                </label>
                {lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-blue-600 hover:underline"
                  >
                    {lead.website}
                  </a>
                ) : (
                  <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                    —
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Search Query
                </label>
                <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {lead.query && lead.query !== "null" ? lead.query : "—"}
                </div>
              </div>
            </div>

            {/* Lead Management */}
            <div className="border-t border-gray-200 pt-4 sm:pt-6">
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={editedLead.status || "Fresh Lead"}
                    onChange={(e) =>
                      setEditedLead({ ...editedLead, status: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isSaving || isDeleting}
                  >
                    <option value="Fresh Lead">Fresh Lead</option>
                    <option value="Interested">Interested</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="Follow-up">Follow-up</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Follow-up date
                  </label>
                  <DatePicker
                    selected={editedLead.follow_up_date}
                    onChange={(date) =>
                      setEditedLead({ ...editedLead, follow_up_date: date })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholderText="Select date"
                    dateFormat="MMM d, yyyy"
                    isClearable
                    disabled={isSaving || isDeleting}
                  />
                </div>
              </div>

              <div className="mt-3 sm:mt-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  value={editedLead.notes || ""}
                  onChange={(e) =>
                    setEditedLead({ ...editedLead, notes: e.target.value })
                  }
                  placeholder="Add notes about this lead..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={3}
                  disabled={isSaving || isDeleting}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border-t border-gray-200 pt-4 sm:pt-6">
              <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
                <button
                  onClick={handleCallPhone}
                  disabled={!lead.phone || isSaving || isDeleting}
                  className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 touch-target"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call
                </button>

                <button
                  onClick={handleVisitWebsite}
                  disabled={!lead.website || isSaving || isDeleting}
                  className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 touch-target"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Visit Website
                </button>

                <button
                  onClick={handleCopyPhone}
                  disabled={!lead.phone || isSaving || isDeleting}
                  className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 touch-target"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Phone
                </button>

                <button
                  onClick={handleDelete}
                  disabled={isSaving || isDeleting}
                  className="flex items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 touch-target"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>

            {/* Messages */}
            {errorMessage && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
                {successMessage}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6 sm:py-4">
          <button
            onClick={handleClose}
            disabled={isSaving || isDeleting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 touch-target"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isDeleting}
            className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 touch-target"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailModal;
