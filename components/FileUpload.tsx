import React, { useRef } from 'react';
import { Upload, FileText, CheckCircle } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  t: any;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, selectedFile, t }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDriveClick = () => {
    // In a real production app, this would verify the user's Google session 
    // and open the Google Picker API (window.google.picker).
    // For this demo, we simulate the action prompt.
    alert("In a production environment, this button would open the Google Drive Picker (OAuth2) to select a file directly.");
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
          ${selectedFile ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'}
        `}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.docx,.txt"
          onChange={(e) => e.target.files && onFileSelect(e.target.files[0])}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center text-green-700">
            <CheckCircle className="w-12 h-12 mb-3" />
            <h3 className="text-lg font-semibold">{selectedFile.name}</h3>
            <p className="text-sm opacity-75">{t.readyForAnalysis}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-slate-500">
            <Upload className="w-12 h-12 mb-3" />
            <h3 className="text-lg font-semibold text-slate-700">{t.uploadTitle}</h3>
            <p className="text-sm mb-4">{t.uploadSubtitle}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold text-slate-400">{t.or}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center">
        <button
            onClick={(e) => { e.stopPropagation(); handleDriveClick(); }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition text-slate-700 font-medium"
        >
            <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" alt="Drive" className="w-5 h-5" />
            {t.uploadBtn}
        </button>
      </div>
    </div>
  );
};

export default FileUpload;