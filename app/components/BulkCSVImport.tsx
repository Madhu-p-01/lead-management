"use client";

import { useState } from "react";
import Papa from "papaparse";
import supabase from "../utils/supabase";

type BulkCSVImportProps = {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
};

type CSVRow = {
  query?: string;
  name?: string;
  reviews?: string;
  rating?: string;
  website?: string;
  phone?: string;
  owner_name?: string;
  competitors?: string;
  [key: string]: string | undefined;
};

const truncateString = (
  value: string | undefined,
  maxLength = 255
): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > maxLength ? trimmed.substring(0, maxLength) : trimmed;
};

const parseCompetitors = (value: string | undefined) => {
  if (!value) return [];
  const text = value;
  const competitors = [];
  const entries = text.split(/\n\n+/);

  for (const entry of entries) {
    const lines = entry
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    let name = null;
    let link = null;
    let reviews = null;

    for (const line of lines) {
      if (line.startsWith("Name:")) {
        name = line.replace("Name:", "").trim();
      } else if (line.startsWith("Link:")) {
        link = line.replace("Link:", "").trim();
      } else if (line.startsWith("Reviews:")) {
        const reviewText = line.replace("Reviews:", "").trim();
        const reviewMatch = reviewText.match(/(\d+)/);
        reviews = reviewMatch ? parseInt(reviewMatch[1], 10) : null;
      }
    }

    if (name) {
      competitors.push({ name, link, reviews });
    }
  }

  return competitors;
};

const BulkCSVImport = ({ isOpen, onClose, onComplete }: BulkCSVImportProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [progress, setProgress] = useState("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
      setSuccessMessage("");
      setErrorMessage("");
      setProgress("");
    } else {
      setFile(null);
    }
  };

  const resetForm = () => {
    setFile(null);
    setErrorMessage("");
    setSuccessMessage("");
    setProgress("");
    const fileInput = document.getElementById(
      "bulk-csv-input"
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");
    setProgress("");

    if (!file) {
      setErrorMessage("Please choose a CSV file to upload.");
      return;
    }

    setIsUploading(true);

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data, errors }) => {
        if (errors && errors.length > 0) {
          setErrorMessage(errors[0].message || "Unable to parse CSV file.");
          setIsUploading(false);
          return;
        }

        try {
          await processBulkImport(data);
        } catch (error) {
          console.error("Import error", error);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to import leads. Please try again."
          );
          setIsUploading(false);
        }
      },
      error: (parseError) => {
        console.error("CSV parsing error", parseError);
        setErrorMessage(parseError.message || "Unable to read CSV file.");
        setIsUploading(false);
      },
    });
  };

  const processBulkImport = async (rows: CSVRow[]) => {
    setProgress("Analyzing CSV data...");

    // Group rows by query value
    const groupedByQuery = new Map<string, CSVRow[]>();

    for (const row of rows) {
      const query = row.query?.trim();
      if (!query || !row.name) continue; // Skip rows without query or name

      if (!groupedByQuery.has(query)) {
        groupedByQuery.set(query, []);
      }
      groupedByQuery.get(query)!.push(row);
    }

    if (groupedByQuery.size === 0) {
      throw new Error("No valid rows found with 'query' and 'name' columns.");
    }

    setProgress(`Found ${groupedByQuery.size} unique categories to create...`);

    let totalLeadsImported = 0;
    let categoriesCreated = 0;

    // Process each query group
    for (const [queryValue, queryRows] of groupedByQuery.entries()) {
      setProgress(
        `Processing category: ${queryValue} (${queryRows.length} leads)...`
      );

      try {
        // Check if category already exists
        const { data: existingCategory } = await supabase
          .from("categories")
          .select("*")
          .eq("name", queryValue)
          .maybeSingle();

        let category = existingCategory;

        // Create category if it doesn't exist
        if (!category) {
          const { data: createdCategory, error: createError } = await supabase
            .from("categories")
            .insert([{ name: queryValue }])
            .select()
            .single();

          if (createError) {
            console.error(
              `Failed to create category ${queryValue}:`,
              createError
            );
            continue;
          }

          category = createdCategory;
          categoriesCreated++;
        }

        // Prepare leads data
        const leadsWithCompetitors = queryRows.map((row) => ({
          lead: {
            name: truncateString(row.name, 255) || "",
            reviews: row.reviews ? Number(row.reviews) : null,
            rating: row.rating ? Number(row.rating) : null,
            website: truncateString(row.website, 255),
            phone: truncateString(row.phone, 50),
            owner_name: truncateString(row.owner_name, 255),
            status: "Fresh Lead",
            follow_up_date: null,
            notes: "",
          },
          competitors: parseCompetitors(row.competitors),
        }));

        const leadsPayload = leadsWithCompetitors.map((item) => item.lead);
        const filteredPayload = leadsPayload.filter((lead) => lead.name);

        if (filteredPayload.length === 0) continue;

        // Insert leads
        const { data: insertedLeads, error: leadInsertError } = await supabase
          .from("leads")
          .insert(filteredPayload)
          .select();

        if (leadInsertError) {
          console.error(
            `Failed to insert leads for ${queryValue}:`,
            leadInsertError
          );
          continue;
        }

        if (insertedLeads && insertedLeads.length > 0) {
          // Link leads to category
          const leadCategoryRows = insertedLeads.map((lead) => ({
            lead_id: lead.id,
            category_id: category.id,
          }));

          const { error: linkError } = await supabase
            .from("lead_categories")
            .insert(leadCategoryRows);

          if (linkError) {
            console.error(
              `Failed to link leads to category ${queryValue}:`,
              linkError
            );
          }

          // Insert competitors
          const competitorsToInsert = [];
          for (let i = 0; i < insertedLeads.length; i++) {
            const lead = insertedLeads[i];
            const competitors = leadsWithCompetitors[i].competitors;

            if (competitors && competitors.length > 0) {
              for (const competitor of competitors) {
                competitorsToInsert.push({
                  lead_id: lead.id,
                  name: truncateString(competitor.name, 500),
                  link: competitor.link,
                  reviews: competitor.reviews,
                });
              }
            }
          }

          if (competitorsToInsert.length > 0) {
            await supabase.from("competitors").insert(competitorsToInsert);
          }

          totalLeadsImported += insertedLeads.length;
        }
      } catch (error) {
        console.error(`Error processing category ${queryValue}:`, error);
      }
    }

    setProgress("");
    setSuccessMessage(
      `Successfully imported ${totalLeadsImported} leads across ${categoriesCreated} new categories!`
    );
    setIsUploading(false);

    // Call onComplete to refresh the categories
    if (typeof onComplete === "function") {
      onComplete();
    }

    // Close modal after 3 seconds
    setTimeout(() => {
      handleClose();
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <svg
                className="h-6 w-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Bulk CSV Import
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            disabled={isUploading}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mb-6 rounded-lg bg-blue-50 p-4">
          <div className="flex gap-3">
            <svg
              className="h-5 w-5 flex-shrink-0 text-blue-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Upload a CSV file with a "query" column</li>
                <li>
                  Each unique value in the "query" column creates a separate
                  category
                </li>
                <li>
                  Leads are automatically assigned to their respective
                  categories
                </li>
                <li>Required columns: query, name</li>
                <li>
                  Optional columns: reviews, rating, website, phone, owner_name,
                  competitors
                </li>
              </ul>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="bulk-csv-input"
              className="flex items-center gap-2 text-sm font-semibold text-gray-800"
            >
              <svg
                className="h-4 w-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              CSV file
            </label>
            <input
              id="bulk-csv-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full cursor-pointer rounded-lg border border-gray-300 text-sm text-gray-600 transition file:mr-4 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-purple-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
              disabled={isUploading}
            />
          </div>

          {progress && (
            <div className="rounded-lg bg-blue-50 p-4">
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 animate-spin text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span className="text-sm font-medium text-blue-800">
                  {progress}
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-lg bg-red-50 p-4">
              <div className="flex items-start gap-2">
                <svg
                  className="h-4 w-4 flex-shrink-0 text-red-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm text-red-800">{errorMessage}</span>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg bg-green-50 p-4">
              <div className="flex items-start gap-2">
                <svg
                  className="h-4 w-4 flex-shrink-0 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm text-green-800">{successMessage}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isUploading}
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Importing...
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  Import Bulk CSV
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkCSVImport;
