import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import FormSection from '../../commons/components/FormSection.jsx';
import Button from '../../commons/components/Button.jsx';
import './FoldersPane.css';

export default function FoldersPane() {
  const [folders, setFolders] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState(null);
  const [progressItems, setProgressItems] = useState([]);
  const progressEndRef = useRef(null);

  useEffect(function () {
    loadFolders();
  }, []);

  useEffect(function () {
    if (progressEndRef.current !== null) {
      progressEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progressItems]);

  async function loadFolders() {
    const result = await invoke('get_folders');
    setFolders(result);
  }

  async function handleAddFolderClick() {
    const path = await invoke('pick_folder');
    if (path === null || path === undefined) {
      return;
    }
    await invoke('add_folder', { path });
    await loadFolders();
  }

  async function handleRemoveFolderClick(folderId) {
    await invoke('remove_folder', { folderId });
    await loadFolders();
  }

  async function handleExtractClick() {
    setIsExtracting(true);
    setExtractionResult(null);
    setProgressItems([]);

    const unlisten = await listen('extract-progress', function (event) {
      const { path, status } = event.payload;
      const filename = path.split('/').pop();
      setProgressItems(function (prev) {
        const existing = prev.findIndex(function (item) { return item.path === path; });
        if (existing !== -1) {
          const updated = [...prev];
          updated[existing] = { path, filename, status };
          return updated;
        }
        return [...prev, { path, filename, status }];
      });
    });

    const result = await invoke('extract_documents');
    unlisten();
    setExtractionResult(result);
    setIsExtracting(false);
  }

  let folderList = null;
  if (folders.length === 0) {
    folderList = <p className="folders-empty">No folders configured. Click "Add Folder" to get started.</p>;
  } else {
    const folderRows = folders.map(function (folder) {
      return (
        <div key={folder.folder_id} className="folder-row">
          <span className="folder-path">{folder.path}</span>
          <Button variant="ghost" onClick={() => handleRemoveFolderClick(folder.folder_id)}>
            Remove
          </Button>
        </div>
      );
    });
    folderList = <div className="folder-list">{folderRows}</div>;
  }

  let extractionResultEl = null;
  if (extractionResult !== null) {
    extractionResultEl = (
      <p className="extraction-result">
        Found {extractionResult.found} files — {extractionResult.extracted} extracted, {extractionResult.skipped} skipped, {extractionResult.errors} errors
      </p>
    );
  }

  let progressLog = null;
  if (progressItems.length > 0) {
    const rows = progressItems.map(function (item) {
      return (
        <div key={item.path} className={`progress-item progress-item-${item.status}`}>
          <span className="progress-item-status">{item.status}</span>
          <span className="progress-item-name">{item.filename}</span>
        </div>
      );
    });
    progressLog = (
      <div className="progress-log">
        {rows}
        <div ref={progressEndRef} />
      </div>
    );
  }

  return (
    <div className="folders-pane">
      <FormSection title="Document Folders" description="Add folders containing PDF documents to import.">
        {folderList}
        <div className="folders-actions">
          <Button onClick={handleAddFolderClick}>Add Folder</Button>
        </div>
      </FormSection>

      <FormSection title="Extract" description="Scan configured folders and extract text from new PDFs.">
        <div className="extract-row">
          <Button isLoading={isExtracting} onClick={handleExtractClick}>
            Extract
          </Button>
          {extractionResultEl}
        </div>
        {progressLog}
      </FormSection>
    </div>
  );
}
