"use client";
import React, { useState } from 'react';
import Papa from 'papaparse'; // CSV parser

const UploadCSV = ({ onUpload }) => {
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = () => {
    if (!file) {
      alert("Please select a CSV file to upload.");
      return;
    }

    Papa.parse(file, {
      complete: (result) => {
        // On successful parsing, pass the parsed data to the parent component
        onUpload(result.data);
      },
      header: true, // Assuming the first row is the header
      skipEmptyLines: true, // Skip empty lines
    });
  };

  return (
    <div className="upload-container">
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload CSV</button>
    </div>
  );
};

export default UploadCSV;
