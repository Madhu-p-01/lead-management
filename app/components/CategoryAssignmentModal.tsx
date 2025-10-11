"use client";

import { useEffect, useState } from "react";
import supabase from "../utils/supabase";

type Category = {
  id: number;
  name: string;
};

type CategoryAssignmentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userId: string;
};

export default function CategoryAssignmentModal({
  isOpen,
  onClose,
  userEmail,
  userId,
}: CategoryAssignmentModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignedCategories, setAssignedCategories] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasRestrictions, setHasRestrictions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all categories
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");

      setCategories(categoriesData || []);

      // Load user's assigned categories
      const { data: assignmentsData } = await supabase
        .from("user_category_assignments")
        .select("category_id")
        .eq("user_id", userId);

      const assigned = assignmentsData?.map((a) => a.category_id) || [];
      setAssignedCategories(assigned);

      // Load user's restriction status
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("has_category_restrictions")
        .eq("id", userId)
        .single();

      setHasRestrictions(profileData?.has_category_restrictions || false);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: number) => {
    setAssignedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing assignments for this user
      await supabase
        .from("user_category_assignments")
        .delete()
        .eq("user_id", userId);

      // Insert new assignments
      if (assignedCategories.length > 0) {
        const assignments = assignedCategories.map((categoryId) => ({
          user_id: userId,
          category_id: categoryId,
        }));

        await supabase.from("user_category_assignments").insert(assignments);

        // Automatically assign all leads in these categories to the user
        let totalLeadsAssigned = 0;
        for (const categoryId of assignedCategories) {
          // Get all lead IDs in this category
          const { data: leadCategoryData, error: fetchError } = await supabase
            .from("lead_categories")
            .select("lead_id")
            .eq("category_id", categoryId);

          if (fetchError) {
            console.error("Error fetching leads for category:", fetchError);
            continue;
          }

          if (leadCategoryData && leadCategoryData.length > 0) {
            const leadIds = leadCategoryData.map((lc) => lc.lead_id);

            // Update ALL leads in this category to assign them to this user
            // This will OVERWRITE any previous assignments
            const { data: updatedLeads, error: updateError } = await supabase
              .from("leads")
              .update({ assigned_to: userId, updated_at: new Date().toISOString() })
              .in("id", leadIds)
              .select();

            if (updateError) {
              console.error("Error assigning leads:", updateError);
            } else if (updatedLeads) {
              totalLeadsAssigned += updatedLeads.length;
              console.log(`Assigned ${updatedLeads.length} leads in category ${categoryId} to user ${userEmail}`);
            }
          }
        }

        if (totalLeadsAssigned > 0) {
          console.log(`Total leads assigned to ${userEmail}: ${totalLeadsAssigned}`);
        }
      }

      // Update user profile restriction status
      await supabase
        .from("user_profiles")
        .update({ has_category_restrictions: hasRestrictions })
        .eq("id", userId);

      onClose();
    } catch (error) {
      console.error("Error saving assignments:", error);
      alert("Failed to save category assignments");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Assign Categories
            </h2>
            <p className="text-sm text-gray-600">{userEmail}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto p-6">
          {/* Restriction Toggle */}
          <div className="mb-6 rounded-lg bg-blue-50 p-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={hasRestrictions}
                onChange={(e) => setHasRestrictions(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-gray-900">
                  Restrict to specific categories
                </span>
                <p className="text-sm text-gray-600">
                  {hasRestrictions
                    ? "User can only see assigned categories"
                    : "User can see all categories"}
                </p>
              </div>
            </label>
          </div>

          {/* Categories List */}
          {loading ? (
            <div className="py-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="mb-3 text-sm font-medium text-gray-700">
                Select categories to assign:
              </p>
              {categories.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">
                  No categories available
                </p>
              ) : (
                categories.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={assignedCategories.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                      disabled={!hasRestrictions}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {category.name}
                    </span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Assignments"}
          </button>
        </div>
      </div>
    </>
  );
}
