"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import supabase from "../../utils/supabase";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";

interface UserActivity {
  userId: string;
  userName: string;
  userEmail: string;
  totalLeads: number;
  contactedToday: number;
  contactedYesterday: number;
  contactedLast7Days: number;
  contactedLast30Days: number;
  interestedToday: number;
  interestedLast7Days: number;
  interestedLast30Days: number;
  notInterestedToday: number;
  notInterestedLast7Days: number;
  notInterestedLast30Days: number;
  followUpScheduled: number;
}

interface StatusChange {
  date: string;
  interested: number;
  notInterested: number;
  followUp: number;
}

export default function AdminAnalytics() {
  const router = useRouter();
  const { user, userRole, loading } = useAuth();
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<
    "today" | "yesterday" | "7days" | "30days"
  >("7days");
  const [statusTrends, setStatusTrends] = useState<StatusChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("all");

  // Dummy sidebar props (analytics doesn't need categories)
  const [categories] = useState<any[]>([]);
  const [selectedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (userRole !== "admin" && userRole !== "superadmin") {
        router.push("/unauthorized");
      } else {
        fetchAnalytics();
      }
    }
  }, [user, userRole, loading, router]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // Fetch all users
      const { data: users, error: usersError } = await supabase
        .from("user_profiles")
        .select("id, email, role")
        .eq("is_authorized", true);

      if (usersError) throw usersError;

      const activities: UserActivity[] = [];

      for (const userProfile of users || []) {
        const activity = await getUserActivity(
          userProfile.id,
          userProfile.email
        );
        activities.push(activity);
      }

      setUserActivities(activities);

      // If a user is selected, fetch their trend data
      if (selectedUser) {
        await fetchStatusTrends(selectedUser);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserActivity = async (
    userId: string,
    userEmail: string
  ): Promise<UserActivity> => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);

    // Get total assigned leads (only from existing categories)
    const { count: totalLeads } = await supabase
      .from("leads")
      .select(`
        *,
        lead_categories!inner (
          category_id,
          categories!inner (id)
        )
      `, { count: "exact", head: true })
      .eq("assigned_to", userId);

    // Get contacted today (status changed from Fresh Lead)
    const { count: contactedToday } = await supabase
      .from("leads")
      .select(`
        *,
        lead_categories!inner (
          category_id,
          categories!inner (id)
        )
      `, { count: "exact", head: true })
      .eq("assigned_to", userId)
      .neq("status", "Fresh Lead")
      .gte("updated_at", today.toISOString());

    // Get contacted yesterday
    const { count: contactedYesterday } = await supabase
      .from("leads")
      .select(`
        *,
        lead_categories!inner (
          category_id,
          categories!inner (id)
        )
      `, { count: "exact", head: true })
      .eq("assigned_to", userId)
      .neq("status", "Fresh Lead")
      .gte("updated_at", yesterday.toISOString())
      .lt("updated_at", today.toISOString());

    // Get contacted last 7 days
    const { count: contactedLast7Days } = await supabase
      .from("leads")
      .select(`
        *,
        lead_categories!inner (
          category_id,
          categories!inner (id)
        )
      `, { count: "exact", head: true })
      .eq("assigned_to", userId)
      .neq("status", "Fresh Lead")
      .gte("updated_at", last7Days.toISOString());

    // Get contacted last 30 days
    const { count: contactedLast30Days } = await supabase
      .from("leads")
      .select(`
        *,
        lead_categories!inner (
          category_id,
          categories!inner (id)
        )
      `, { count: "exact", head: true })
      .eq("assigned_to", userId)
      .neq("status", "Fresh Lead")
      .gte("updated_at", last30Days.toISOString());

    // Get interested counts
    const { count: interestedToday } = await supabase
      .from("leads")
      .select(`
        *,
        lead_categories!inner (
          category_id,
          categories!inner (id)
        )
      `, { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "Interested")
      .gte("updated_at", today.toISOString());

    const { count: interestedLast7Days } = await supabase
      .from("leads")
      .select(`
        *,
        lead_categories!inner (
          category_id,
          categories!inner (id)
        )
      `, { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "Interested")
      .gte("updated_at", last7Days.toISOString());

    const { count: interestedLast30Days } = await supabase
      .from("leads")
      .select(`
        *,
        lead_categories!inner (
          category_id,
          categories!inner (id)
        )
      `, { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "Interested")
      .gte("updated_at", last30Days.toISOString());

    // Get not interested counts
    const { count: notInterestedToday } = await supabase
      .from("leads")
      .select(`
        *,
        lead_categories!inner (
          category_id,
          categories!inner (id)
        )
      `, { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "Not Interested")
      .gte("updated_at", today.toISOString());

    const { count: notInterestedLast7Days } = await supabase
      .from("leads")
      .select(`
        *,
        lead_categories!inner (
          category_id,
          categories!inner (id)
        )
      `, { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "Not Interested")
      .gte("updated_at", last7Days.toISOString());

    const { count: notInterestedLast30Days } = await supabase
      .from("leads")
      .select(`
        *,
        lead_categories!inner (
          category_id,
          categories!inner (id)
        )
      `, { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "Not Interested")
      .gte("updated_at", last30Days.toISOString());

    // Get follow-up scheduled
    const { count: followUpScheduled } = await supabase
      .from("leads")
      .select(`
        *,
        lead_categories!inner (
          category_id,
          categories!inner (id)
        )
      `, { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "Follow-up")
      .not("follow_up_date", "is", null);

    return {
      userId,
      userName: userEmail.split("@")[0],
      userEmail,
      totalLeads: totalLeads || 0,
      contactedToday: contactedToday || 0,
      contactedYesterday: contactedYesterday || 0,
      contactedLast7Days: contactedLast7Days || 0,
      contactedLast30Days: contactedLast30Days || 0,
      interestedToday: interestedToday || 0,
      interestedLast7Days: interestedLast7Days || 0,
      interestedLast30Days: interestedLast30Days || 0,
      notInterestedToday: notInterestedToday || 0,
      notInterestedLast7Days: notInterestedLast7Days || 0,
      notInterestedLast30Days: notInterestedLast30Days || 0,
      followUpScheduled: followUpScheduled || 0,
    };
  };

  const fetchStatusTrends = async (userId: string) => {
    const trends: StatusChange[] = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { count: interested } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .eq("status", "Interested")
        .gte("updated_at", date.toISOString())
        .lt("updated_at", nextDate.toISOString());

      const { count: notInterested } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .eq("status", "Not Interested")
        .gte("updated_at", date.toISOString())
        .lt("updated_at", nextDate.toISOString());

      const { count: followUp } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .eq("status", "Follow-up")
        .gte("updated_at", date.toISOString())
        .lt("updated_at", nextDate.toISOString());

      trends.push({
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        interested: interested || 0,
        notInterested: notInterested || 0,
        followUp: followUp || 0,
      });
    }

    setStatusTrends(trends);
  };

  const handleUserSelect = async (userId: string) => {
    setSelectedUser(userId);
    await fetchStatusTrends(userId);
  };

  const getActivityValue = (activity: UserActivity) => {
    switch (timeRange) {
      case "today":
        return activity.contactedToday;
      case "yesterday":
        return activity.contactedYesterday;
      case "7days":
        return activity.contactedLast7Days;
      case "30days":
        return activity.contactedLast30Days;
      default:
        return 0;
    }
  };

  const getInterestedValue = (activity: UserActivity) => {
    switch (timeRange) {
      case "today":
        return activity.interestedToday;
      case "7days":
        return activity.interestedLast7Days;
      case "30days":
        return activity.interestedLast30Days;
      default:
        return 0;
    }
  };

  const getNotInterestedValue = (activity: UserActivity) => {
    switch (timeRange) {
      case "today":
        return activity.notInterestedToday;
      case "7days":
        return activity.notInterestedLast7Days;
      case "30days":
        return activity.notInterestedLast30Days;
      default:
        return 0;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const selectedUserData = userActivities.find(
    (a) => a.userId === selectedUser
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar
          categories={categories}
          selectedCategoryId={null}
          isLoadingCategories={false}
          categoryError=""
          onCategoryChange={() => {}}
          onRefresh={() => {}}
          onDeleteCategory={() => {}}
          onImportClick={() => {}}
        />

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {isLoading ? (
            // Skeleton Loader
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="h-8 w-64 animate-pulse rounded bg-gray-200"></div>
                <div className="h-4 w-96 animate-pulse rounded bg-gray-200"></div>
              </div>

              <div className="flex gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-10 w-32 animate-pulse rounded-lg bg-gray-200"
                  ></div>
                ))}
              </div>

              <div className="card overflow-hidden p-0">
                <div className="space-y-4 p-6">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="h-12 w-48 animate-pulse rounded bg-gray-200"></div>
                      <div className="h-12 w-24 animate-pulse rounded bg-gray-200"></div>
                      <div className="h-12 w-24 animate-pulse rounded bg-gray-200"></div>
                      <div className="h-12 w-24 animate-pulse rounded bg-gray-200"></div>
                      <div className="h-12 w-24 animate-pulse rounded bg-gray-200"></div>
                      <div className="h-12 w-24 animate-pulse rounded bg-gray-200"></div>
                      <div className="h-12 w-32 animate-pulse rounded bg-gray-200"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  User Activity Analytics
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  Monitor team performance and lead management activity
                </p>
              </div>

              {/* Filters Section */}
              <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
                {/* Time Range Selector */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Time Range
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setTimeRange("today")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        timeRange === "today"
                          ? "bg-primary-600 text-white"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setTimeRange("yesterday")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        timeRange === "yesterday"
                          ? "bg-primary-600 text-white"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Yesterday
                    </button>
                    <button
                      onClick={() => setTimeRange("7days")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        timeRange === "7days"
                          ? "bg-primary-600 text-white"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Last 7 Days
                    </button>
                    <button
                      onClick={() => setTimeRange("30days")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        timeRange === "30days"
                          ? "bg-primary-600 text-white"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Last 30 Days
                    </button>
                  </div>
                </div>

                {/* User Filter */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Filter by User
                  </label>
                  <select
                    value={selectedUserFilter}
                    onChange={(e) => setSelectedUserFilter(e.target.value)}
                    className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  >
                    <option value="all">All Users</option>
                    {userActivities.map((activity) => (
                      <option key={activity.userId} value={activity.userId}>
                        {activity.userEmail}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* User Activity Table */}
              <div className="overflow-hidden rounded-lg bg-white shadow mb-4 sm:mb-6 -mx-4 sm:mx-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Total Leads
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Contacted
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Interested
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Not Interested
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Follow-ups
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {userActivities
                        .filter(
                          (activity) =>
                            selectedUserFilter === "all" ||
                            activity.userId === selectedUserFilter
                        )
                        .map((activity) => (
                          <tr
                            key={activity.userId}
                            className={`transition hover:bg-gray-50 ${
                              selectedUser === activity.userId
                                ? "bg-primary-50"
                                : ""
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-medium text-gray-900">
                                  {activity.userName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {activity.userEmail}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-lg font-semibold text-gray-900">
                                {activity.totalLeads}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-lg font-semibold text-blue-600">
                                {getActivityValue(activity)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-lg font-semibold text-green-600">
                                {getInterestedValue(activity)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-lg font-semibold text-red-600">
                                {getNotInterestedValue(activity)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-lg font-semibold text-purple-600">
                                {activity.followUpScheduled}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() =>
                                  handleUserSelect(activity.userId)
                                }
                                className="btn btn-sm btn-primary"
                              >
                                View Trends
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Trend Chart */}
              {selectedUser && selectedUserData && (
                <div className="rounded-lg bg-white p-6 shadow">
                  <h2 className="mb-4 text-xl font-bold text-gray-900">
                    Activity Trend - {selectedUserData.userName}
                  </h2>
                  <div className="h-96 overflow-x-auto">
                    <div className="flex h-full min-w-[800px] items-end gap-2 border-b border-l border-gray-300 pb-8 pl-8">
                      {statusTrends.map((trend, index) => {
                        const maxValue = Math.max(
                          ...statusTrends.map(
                            (t) => t.interested + t.notInterested + t.followUp
                          )
                        );
                        const total =
                          trend.interested +
                          trend.notInterested +
                          trend.followUp;
                        const heightPercent =
                          maxValue > 0 ? (total / maxValue) * 100 : 0;

                        return (
                          <div
                            key={index}
                            className="flex flex-1 flex-col items-center gap-2"
                          >
                            <div
                              className="flex w-full flex-col gap-1"
                              style={{ height: "300px" }}
                            >
                              <div className="flex flex-1 flex-col justify-end gap-1">
                                {trend.interested > 0 && (
                                  <div
                                    className="w-full rounded-t bg-green-500"
                                    style={{
                                      height: `${
                                        (trend.interested / maxValue) * 100
                                      }%`,
                                    }}
                                    title={`Interested: ${trend.interested}`}
                                  ></div>
                                )}
                                {trend.followUp > 0 && (
                                  <div
                                    className="w-full bg-purple-500"
                                    style={{
                                      height: `${
                                        (trend.followUp / maxValue) * 100
                                      }%`,
                                    }}
                                    title={`Follow-up: ${trend.followUp}`}
                                  ></div>
                                )}
                                {trend.notInterested > 0 && (
                                  <div
                                    className="w-full bg-red-500"
                                    style={{
                                      height: `${
                                        (trend.notInterested / maxValue) * 100
                                      }%`,
                                    }}
                                    title={`Not Interested: ${trend.notInterested}`}
                                  ></div>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-gray-600">
                              {trend.date}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-6 flex justify-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded bg-green-500"></div>
                      <span className="text-sm text-gray-700">Interested</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded bg-purple-500"></div>
                      <span className="text-sm text-gray-700">Follow-up</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded bg-red-500"></div>
                      <span className="text-sm text-gray-700">
                        Not Interested
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
