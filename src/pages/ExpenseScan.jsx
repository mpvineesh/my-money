import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2, ScanLine, Trash2, Upload, X } from 'lucide-react';
import { useApp } from '../context/useApp';
import {
  DEFAULT_EXPENSE_PAYER,
  EXPENSE_PAYMENT_METHODS,
  formatCurrency,
  getExpenseCategoryInfo,
  getExpenseCategoryOptions,
  getExpenseSubcategories,
  getExpenseSubcategoryInfo,
} from '../utils/constants';
import './InvestmentForm.css';
import './ExpenseScan.css';

async function compressImage(file, maxDim = 1600, quality = 0.85) {
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = blobUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Could not read image.'));
    });
    const ratio = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1);
    const width = Math.max(1, Math.round(img.naturalWidth * ratio));
    const height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const [meta, base64] = dataUrl.split(',');
    const mimeType = (meta.match(/data:(.*);base64/) || [])[1] || 'image/jpeg';
    return { dataUrl, base64, mimeType };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function getTodayDateValue() {
  const now = new Date();
  const adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}

function normalizeParsedRow(item, expenseCategories, expenseSubcategories) {
  const categoryInfo = getExpenseCategoryInfo(item.category, expenseCategories, item.category);
  const categoryValue = categoryInfo?.value || 'other';
  const subcategoryInfo = item.subcategory
    ? getExpenseSubcategoryInfo(categoryValue, item.subcategory, expenseSubcategories, item.subcategory)
    : null;
  const paymentMethod = EXPENSE_PAYMENT_METHODS.find((method) => method.value === item.paymentMethod)?.value
    || EXPENSE_PAYMENT_METHODS[0].value;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : getTodayDateValue();

  return {
    name: item.name || '',
    amount: item.amount > 0 ? String(item.amount) : '',
    date,
    categoryValue,
    categoryLabel: categoryInfo?.label || '',
    subcategoryValue: subcategoryInfo?.value || '',
    subcategoryLabel: subcategoryInfo?.label || '',
    paymentMethod,
    notes: item.notes || '',
    confidence: item.confidence || 'medium',
  };
}

export default function ExpenseScan() {
  const navigate = useNavigate();
  const {
    expenseCategories,
    expenseSubcategories,
    parseReceipt,
    addExpense,
  } = useApp();

  const [stage, setStage] = useState('capture'); // capture | parsing | review-list | error
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageBlob, setImageBlob] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [parserNote, setParserNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = useMemo(
    () => getExpenseCategoryOptions(expenseCategories),
    [expenseCategories],
  );

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMessage('');
    try {
      const compressed = await compressImage(file);
      setPreviewUrl(compressed.dataUrl);
      setImageBlob({ base64: compressed.base64, mimeType: compressed.mimeType });
    } catch (err) {
      setErrorMessage(err?.message || 'Could not read image.');
    }
  };

  const handleClearImage = () => {
    setPreviewUrl('');
    setImageBlob(null);
    setParsedRows([]);
    setParserNote('');
    setStage('capture');
  };

  const handleParse = async () => {
    if (!imageBlob) return;
    setStage('parsing');
    setErrorMessage('');
    try {
      const response = await parseReceipt({
        image: imageBlob.base64,
        mimeType: imageBlob.mimeType,
        provider: 'openai',
      });
      const result = response?.result;
      if (!result || result.kind === 'unreadable' || !result.items?.length) {
        setStage('error');
        setErrorMessage(result?.note || 'Could not read any expenses from this image. Try a clearer photo.');
        return;
      }

      if (result.kind === 'single') {
        const row = normalizeParsedRow(result.items[0], expenseCategories, expenseSubcategories);
        navigate('/expenses/new', {
          state: {
            prefill: {
              name: row.name,
              amount: row.amount,
              dateTime: `${row.date}T09:00`,
              category: row.categoryValue,
              categoryLabel: row.categoryLabel,
              subcategory: row.subcategoryValue,
              subcategoryLabel: row.subcategoryLabel,
              paymentMethod: row.paymentMethod,
              notes: row.notes,
            },
          },
        });
        return;
      }

      const rows = result.items.map((item) => normalizeParsedRow(item, expenseCategories, expenseSubcategories));
      setParsedRows(rows);
      setParserNote(result.note || '');
      setStage('review-list');
    } catch (err) {
      setStage('error');
      setErrorMessage(err?.message || 'Could not parse the receipt.');
    }
  };

  const updateRow = (index, patch) => {
    setParsedRows((prev) => prev.map((row, idx) => {
      if (idx !== index) return row;
      const next = { ...row, ...patch };
      if (patch.categoryValue !== undefined) {
        const info = getExpenseCategoryInfo(patch.categoryValue, expenseCategories, patch.categoryValue);
        next.categoryValue = info?.value || patch.categoryValue || 'other';
        next.categoryLabel = info?.label || '';
        next.subcategoryValue = '';
        next.subcategoryLabel = '';
      }
      if (patch.subcategoryValue !== undefined) {
        const info = patch.subcategoryValue
          ? getExpenseSubcategoryInfo(next.categoryValue, patch.subcategoryValue, expenseSubcategories, patch.subcategoryValue)
          : null;
        next.subcategoryValue = info?.value || '';
        next.subcategoryLabel = info?.label || '';
      }
      return next;
    }));
  };

  const removeRow = (index) => {
    setParsedRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const validRows = parsedRows.filter((row) => Number(row.amount) > 0 && row.name.trim());
  const totalAmount = validRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const handleAddAll = async () => {
    if (!validRows.length) return;
    setSubmitting(true);
    try {
      validRows.forEach((row) => {
        addExpense({
          name: row.name.trim(),
          amount: Number(row.amount) || 0,
          dateTime: `${row.date}T09:00`,
          category: row.categoryValue,
          categoryLabel: row.categoryLabel,
          subcategory: row.subcategoryValue,
          subcategoryLabel: row.subcategoryLabel,
          paymentMethod: row.paymentMethod,
          notes: row.notes,
          paidById: DEFAULT_EXPENSE_PAYER.id,
          paidByName: DEFAULT_EXPENSE_PAYER.name,
        });
      });
      navigate('/expenses');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="form-page">
      <header className="form-header">
        <button type="button" className="form-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="form-title">Scan a Bill</h1>
        <div style={{ width: 36 }} />
      </header>

      {stage === 'capture' || stage === 'parsing' || stage === 'error' ? (
        <div className="form-body">
          <div className="scan-hero">
            <div className="scan-hero-icon"><ScanLine size={28} /></div>
            <h2>Snap a receipt or your handwritten expense list</h2>
            <p>
              We&apos;ll read it with AI and pre-fill an expense for review. If it&apos;s a list of separate
              expenses, we&apos;ll show all of them so you can confirm before adding.
            </p>
          </div>

          <div className="scan-actions">
            <label className="scan-cta">
              <Camera size={18} />
              <span>Take photo</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                hidden
              />
            </label>
            <label className="scan-cta scan-cta-secondary">
              <Upload size={18} />
              <span>Choose from gallery</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                hidden
              />
            </label>
          </div>

          {previewUrl ? (
            <div className="scan-preview">
              <img src={previewUrl} alt="Receipt preview" />
              <button type="button" className="scan-preview-clear" onClick={handleClearImage} aria-label="Remove image">
                <X size={16} />
              </button>
            </div>
          ) : null}

          {errorMessage ? <p className="scan-error">{errorMessage}</p> : null}

          <div className="form-actions">
            <button
              type="button"
              className="btn-primary form-submit-btn"
              disabled={!imageBlob || stage === 'parsing'}
              onClick={handleParse}
            >
              {stage === 'parsing' ? <Loader2 size={18} className="scan-spinner" /> : <ScanLine size={18} />}
              {stage === 'parsing' ? 'Parsing…' : 'Parse receipt'}
            </button>
          </div>
        </div>
      ) : null}

      {stage === 'review-list' ? (
        <div className="form-body">
          <div className="scan-review-head">
            <h2>{parsedRows.length} expense{parsedRows.length === 1 ? '' : 's'} parsed</h2>
            <p>
              Review the items below, edit any field, remove anything that doesn&apos;t belong, then add them all.
              {parserNote ? <> <em>{parserNote}</em></> : null}
            </p>
          </div>

          <div className="scan-rows">
            {parsedRows.map((row, index) => {
              const subcategoryOptions = getExpenseSubcategories(row.categoryValue, expenseSubcategories);
              return (
                <div key={index} className={`scan-row scan-row-conf-${row.confidence}`}>
                  <div className="scan-row-head">
                    <input
                      type="text"
                      className="form-input scan-row-name"
                      placeholder="Description"
                      value={row.name}
                      onChange={(event) => updateRow(index, { name: event.target.value })}
                    />
                    <button type="button" className="scan-row-remove" onClick={() => removeRow(index)} aria-label="Remove row">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="scan-row-grid">
                    <div className="form-input-prefix">
                      <span className="form-prefix">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-input"
                        value={row.amount}
                        onChange={(event) => updateRow(index, { amount: event.target.value })}
                      />
                    </div>
                    <input
                      type="date"
                      className="form-input"
                      value={row.date}
                      onChange={(event) => updateRow(index, { date: event.target.value })}
                    />
                    <select
                      className="form-input"
                      value={row.categoryValue}
                      onChange={(event) => updateRow(index, { categoryValue: event.target.value })}
                    >
                      {categoryOptions.map((category) => (
                        <option key={category.value} value={category.value}>{category.label}</option>
                      ))}
                    </select>
                    <select
                      className="form-input"
                      value={row.subcategoryValue}
                      onChange={(event) => updateRow(index, { subcategoryValue: event.target.value })}
                    >
                      <option value="">Subcategory (optional)</option>
                      {subcategoryOptions.map((sub) => (
                        <option key={`${sub.categoryValue}:${sub.value}`} value={sub.value}>{sub.label}</option>
                      ))}
                    </select>
                    <select
                      className="form-input"
                      value={row.paymentMethod}
                      onChange={(event) => updateRow(index, { paymentMethod: event.target.value })}
                    >
                      {EXPENSE_PAYMENT_METHODS.map((method) => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="scan-summary">
            <span>{validRows.length} valid · Total {formatCurrency(totalAmount)}</span>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-primary form-submit-btn"
              disabled={!validRows.length || submitting}
              onClick={handleAddAll}
            >
              {submitting ? <Loader2 size={18} className="scan-spinner" /> : null}
              Add {validRows.length} expense{validRows.length === 1 ? '' : 's'}
            </button>
            <button type="button" className="btn-cancel" onClick={handleClearImage} disabled={submitting}>
              Start over
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
