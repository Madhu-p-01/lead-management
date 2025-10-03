"use client";

import { useState } from "react";
import Papa from "papaparse";
import supabase from "../utils/supabase";

const splitCompetitors = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => `${item}`.trim()).filter(Boolean);
  }

  return `${value}`
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
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
          const { category, importedCount } = await importLeads(validRows, trimmedCategoryName);

          resetForm();
          setIsUploading(false);
          setSuccessMessage(`Imported ${importedCount} lead${importedCount === 1 ? "" : "s"} into ${category.name}.`);

          if (typeof onComplete === "function") {
            onComplete(category, importedCount);
          }
        } catch (error) {
          console.error("Import error", error);
          setErrorMessage(error.message || "Failed to import leads. Please try again.");
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
      const { data: createdCategory, error: insertCategoryError } = await supabase
        .from("categories")
        .insert([{ name: categoryTitle }])
        .select()
        .single();

      if (insertCategoryError) {
        throw new Error(`Failed to create category: ${insertCategoryError.message}`);
      }

      category = createdCategory;
    }

    const leadsPayload = rows.map((row) => ({
      name: row.name ? `${row.name}`.trim() : "",
      reviews: row.reviews ? Number(row.reviews) : null,
      rating: row.rating ? Number(row.rating) : null,
      competitors: splitCompetitors(row.competitors),
      website: row.website ? `${row.website}`.trim() || null : null,
      phone: row.phone ? `${row.phone}`.trim() || null : null,
      owner_name: row.owner_name ? `${row.owner_name}`.trim() || null : null,
      status: "Interested",
      follow_up_date: null,
      notes: "",
    }));

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
      const leadCategoryRows = insertedLeads.map((lead) => ({
        lead_id: lead.id,
        category_id: category.id,
      }));

      const { error: linkError } = await supabase.from("lead_categories").insert(leadCategoryRows);

      if (linkError) {
        throw new Error(`Failed to link leads to category: ${linkError.message}`);
      }
    }

    return { category, importedCount: insertedLeads.length };
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900">Import Leads</h2>
        <p className="text-sm text-gray-600">
          Upload a CSV that includes the columns: name, reviews, rating, competitors, website, phone, owner_name.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div className="space-y-2">
          <label htmlFor="category-name" className="text-sm font-semibold text-gray-800">
            Category name
          </label>
          <input
            id="category-name"
            type="text"
            value={categoryName}
            onChange={handleCategoryChange}
            placeholder="e.g. October Prospects"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="lead-csv-input" className="text-sm font-semibold text-gray-800">
            CSV file
          </label>
          <input
            id="lead-csv-input"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-600 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-400">
            Tip: export from Google Sheets or Excel in CSV format. Empty rows are ignored.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={isUploading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isUploading ? "Importing..." : "Import leads"}
          </button>
        </div>
      </form>
    </section>
  );
};

export default CSVImport;
