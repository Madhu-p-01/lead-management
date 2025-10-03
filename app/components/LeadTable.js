import React, { useState } from "react";

const LeadTable = ({ leads }) => {
  const [status, setStatus] = useState("");

  // Update lead status
  const handleStatusChange = async (leadId, newStatus) => {
    // Update the lead status in Supabase (or manage it in your local state)
    const { error } = await supabase
      .from("lead_management")
      .upsert({ lead_id: leadId, status: newStatus });

    if (error) {
      console.error("Error updating status:", error.message);
    } else {
      alert("Status updated!");
    }
  };

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Phone</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>{lead.name}</td>
              <td>
                <select
                  value={lead.status}
                  onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                >
                  <option value="Fresh Lead">Fresh Lead</option>
                  <option value="Interested">Interested</option>
                  <option value="Follow Up">Follow Up</option>
                  <option value="False Lead">False Lead</option>
                </select>
              </td>
              <td>{lead.phone}</td>
              <td>
                <button onClick={() => console.log("More Actions")}>More Actions</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeadTable;
