"use client";

import { useState } from "react";
import Papa from "papaparse";
import supabase from "../utils/supabase";

// Parse competitors from CSV format
const parseCompetitors = (value) => {
  if (!value) {
    return [];
  }

  const text = Array.isArray(value) ? value.join("\n") : `${value}`;
  const competitors = [];

  // Split by double newlines to separate each competitor entry
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

// Helper function to truncate strings to database field limits
const truncateString = (value, maxLength = 255) => {
  if (!value) return null;
  const trimmed = `${value}`.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > maxLength ? trimmed.substring(0, maxLength) : trimmed;
};

const CSVImport = ({ onComplete }) => {
  const [categoryName, setCategoryName] = useState("");
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
      setSuccessMessage("");
    } else {
      setFile(null);
    }
  };

  const handleCategoryChange = (event) => {
    setCategoryName(event.target.value);
    setSuccessMessage("");
  };

  const resetForm = () => {
    setCategoryName("");
    setFile(null);
    if (typeof window !== "undefined") {
      const fileInput = document.getElementById("lead-csv-input");
      if (fileInput) {
        fileInput.value = "";
      }
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    setSuccessMessage("");

    if (!file) {
      setErrorMessage("Please choose a CSV file to upload.");
      return;
    }

    const trimmedCategoryName = categoryName.trim();

    if (!trimmedCategoryName) {
      setErrorMessage("Please provide a category name.");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data, errors }) => {
        if (errors && errors.length > 0) {
          setErrorMessage(errors[0].message || "Unable to parse CSV file.");
          setIsUploading(false);
          return;
        }

        const validRows = data.filter((row) => row && row.name);

        if (!validRows.length) {
          setErrorMessage("No valid rows found in the CSV file.");
          setIsUploading(false);
          return;
        }

        try {
          const { category, importedCount } = await importLeads(
            validRows,
            trimmedCategoryName
          );

          resetForm();
          setIsUploading(false);
          setSuccessMessage(
            `Imported ${importedCount} lead${
              importedCount === 1 ? "" : "s"
            } into ${category.name}.`
          );

          if (typeof onComplete === "function") {
            onComplete(category, importedCount);
          }
        } catch (error) {
          console.error("Import error", error);
          setErrorMessage(
            error.message || "Failed to import leads. Please try again."
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

  const importLeads = async (rows, categoryTitle) => {
    const { data: existingCategory, error: lookupError } = await supabase
      .from("categories")
      .select("*")
      .eq("name", categoryTitle)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Failed to lookup category: ${lookupError.message}`);
    }

    let category = existingCategory;

    if (!category) {
      const { data: createdCategory, error: insertCategoryError } =
        await supabase
          .from("categories")
          .insert([{ name: categoryTitle }])
          .select()
          .single();

      if (insertCategoryError) {
        throw new Error(
          `Failed to create category: ${insertCategoryError.message}`
        );
      }

      category = createdCategory;
    }

    // Prepare leads data with competitors parsed separately
    const leadsWithCompetitors = rows.map((row) => {
      // Debug: Log the query value
      console.log('Row query value:', row.query);
      
      return {
        lead: {
          name: truncateString(row.name, 255) || "",
          reviews: row.reviews ? Number(row.reviews) : null,
          rating: row.rating ? Number(row.rating) : null,
          website: truncateString(row.website, 255),
          phone: truncateString(row.phone, 50),
          owner_name: truncateString(row.owner_name, 255),
          query: row.query ? truncateString(row.query, 500) : null,
          status: "Fresh Lead",
          follow_up_date: null,
          notes: "",
        },
        competitors: parseCompetitors(row.competitors),
      };
    });

    const leadsPayload = leadsWithCompetitors.map((item) => item.lead);

    const filteredPayload = leadsPayload.filter((lead) => lead.name);

    if (!filteredPayload.length) {
      throw new Error("No leads with a name were found in the CSV file.");
    }

    const { data: insertedLeads, error: leadInsertError } = await supabase
      .from("leads")
      .insert(filteredPayload)
      .select();

    if (leadInsertError) {
      throw new Error(`Failed to insert leads: ${leadInsertError.message}`);
    }

    if (insertedLeads.length) {
      // Link leads to category
      const leadCategoryRows = insertedLeads.map((lead) => ({
        lead_id: lead.id,
        category_id: category.id,
      }));

      const { error: linkError } = await supabase
        .from("lead_categories")
        .insert(leadCategoryRows);

      if (linkError) {
        throw new Error(
          `Failed to link leads to category: ${linkError.message}`
        );
      }

      // Insert competitors for each lead
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

      // Insert all competitors in batch
      if (competitorsToInsert.length > 0) {
        const { error: competitorsError } = await supabase
          .from("competitors")
          .insert(competitorsToInsert);

        if (competitorsError) {
          console.error("Failed to insert competitors:", competitorsError);
          // Don't throw error here - leads are already inserted
          // Just log the error and continue
        }
      }
    }

    return { category, importedCount: insertedLeads.length };
  };

  return (
    <section
      className="card animate-slide-up p-6"
      style={{ animationDelay: "0.1s" }}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-primary-600"
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
          <h2 className="text-xl font-bold text-gray-900">Import Leads</h2>
        </div>
        <p className="text-sm leading-relaxed text-gray-600">
          Upload a CSV that includes the columns: name, reviews, rating,
          competitors, website, phone, owner_name, query.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="category-name"
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
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            Category name
          </label>
          <input
            id="category-name"
            type="text"
            value={categoryName}
            onChange={handleCategoryChange}
            placeholder="e.g. October Prospects"
            className="input"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="lead-csv-input"
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
          <div className="relative">
            <input
              id="lead-csv-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full cursor-pointer rounded-lg border border-gray-300 text-sm text-gray-600 transition file:mr-4 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-primary-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-primary-700 hover:file:bg-primary-100 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <p className="flex items-start gap-1.5 text-xs text-gray-500">
            <svg
              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              Tip: export from Google Sheets or Excel in CSV format. Empty rows
              are ignored.
            </span>
          </p>
        </div>

        {errorMessage && (
          <div className="alert alert-error animate-scale-in flex items-start gap-2">
            <svg
              className="h-4 w-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success animate-scale-in flex items-start gap-2">
            <svg
              className="h-4 w-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={isUploading}
            className="btn btn-primary"
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
                Import leads
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
};

export default CSVImport;
