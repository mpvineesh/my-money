/* global process */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import OpenAI from 'openai';

const app = express();
const port = Number(process.env.PORT) || 8787;
const defaultAiProvider = String(process.env.AI_PROVIDER || 'openai').trim().toLowerCase();
const openAiModel = process.env.OPENAI_MODEL || 'gpt-5-mini';
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || '';

function readServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    return JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
  }

  return null;
}

const serviceAccount = readServiceAccount();
initializeApp({
  credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
  projectId: firebaseProjectId || serviceAccount?.project_id,
});

const auth = getAuth();
const db = getFirestore();

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'wins', 'risks', 'recommendations', 'anomalies', 'investmentInsights'],
  properties: {
    summary: { type: 'string' },
    wins: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
    risks: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
    recommendations: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'reason', 'priority'],
        properties: {
          title: { type: 'string' },
          reason: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    anomalies: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['area', 'finding'],
        properties: {
          area: { type: 'string' },
          finding: { type: 'string' },
        },
      },
    },
    investmentInsights: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
  },
};

const ASK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'highlights', 'scenarioSummary'],
  properties: {
    answer: { type: 'string' },
    highlights: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
    },
    scenarioSummary: { type: 'string' },
  },
};

const AI_REPORT_SYSTEM_PROMPT =
  'You are a personal finance analyst for a money-tracking app. Use only the provided JSON. Do not invent transactions or balances. Avoid regulated financial advice, and give practical observations and next steps. Balance the report across expenses and investments, and explicitly comment on portfolio progress, gains or losses, and concentration where data supports it.';
const AI_ASK_SYSTEM_PROMPT =
  'You are a personal finance analyst for a money-tracking app. Use only the provided JSON. Answer the user question directly, keep assumptions explicit, and do not invent transactions, returns, or interest savings. If a what-if scenario is provided, reason from the deterministic scenario values instead of making up projections.';

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function fingerprintSecret(secret) {
  const value = String(secret || '').trim();
  if (!value) return 'missing';
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function getFirebaseCredentialSource() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return 'env-json';
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) return 'file-path';
  return 'application-default';
}

function logStartupConfig() {
  console.info('AI server startup config', {
    port,
    defaultAiProvider,
    openAiModel,
    geminiModel,
    openAiKeyFingerprint: fingerprintSecret(process.env.OPENAI_API_KEY),
    geminiKeyFingerprint: fingerprintSecret(process.env.GEMINI_API_KEY),
    firebaseProjectId: firebaseProjectId || serviceAccount?.project_id || 'unset',
    firebaseCredentialSource: getFirebaseCredentialSource(),
    corsOrigin: process.env.CORS_ORIGIN || '*',
  });
}

function logAiError(provider, model, error) {
  console.error(`${provider} request failed`, {
    status: error?.status || 'unknown',
    code: error?.code || 'unknown',
    type: error?.type || 'unknown',
    requestId: error?.request_id || error?.headers?.['x-request-id'] || 'unknown',
    model,
    openAiKeyFingerprint: fingerprintSecret(process.env.OPENAI_API_KEY),
    geminiKeyFingerprint: fingerprintSecret(process.env.GEMINI_API_KEY),
    message: error?.message || 'unknown',
  });
}

function normalizeAiProvider(provider) {
  const value = String(provider || defaultAiProvider || 'openai').trim().toLowerCase();
  return value === 'gemini' ? 'gemini' : 'openai';
}

function getProviderModel(provider) {
  return provider === 'gemini' ? geminiModel : openAiModel;
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePeriodKey(periodKey) {
  const value = String(periodKey || '').trim();
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw createError(400, 'periodKey must be in YYYY-MM format.');
  }

  const [year, month] = value.split('-').map(Number);
  if (month < 1 || month > 12) {
    throw createError(400, 'periodKey must contain a valid month.');
  }

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const nextMonthDate = new Date(Date.UTC(year, month, 1));
  const previousMonthDate = new Date(Date.UTC(year, month - 2, 1));

  return {
    periodKey: value,
    periodLabel: startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    startDateKey: value,
    nextMonthKey: `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, '0')}`,
    previousMonthKey: `${previousMonthDate.getUTCFullYear()}-${String(previousMonthDate.getUTCMonth() + 1).padStart(2, '0')}`,
  };
}

function normalizeLabel(value, fallback = 'Other') {
  const text = String(value || '').trim();
  return text || fallback;
}

function titleCaseLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toPercent(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function buildTopBreakdown(items, getLabel, limit = 5) {
  const totals = new Map();

  items.forEach((item) => {
    const label = normalizeLabel(getLabel(item));
    totals.set(label, (totals.get(label) || 0) + safeNumber(item.amount));
  });

  return [...totals.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, limit);
}

function summarizeExpenses(expenses, previousExpenses) {
  const totalSpent = expenses.reduce((sum, expense) => sum + safeNumber(expense.amount), 0);
  const previousSpent = previousExpenses.reduce((sum, expense) => sum + safeNumber(expense.amount), 0);
  const expenseCount = expenses.length;

  const categories = buildTopBreakdown(expenses, (expense) => expense.categoryLabel || expense.category);
  const subcategories = buildTopBreakdown(expenses, (expense) => expense.subcategoryLabel || expense.subcategory || 'Uncategorized');
  const projects = buildTopBreakdown(expenses, (expense) => expense.project || 'No Project');

  return {
    totalSpent,
    previousSpent,
    expenseCount,
    averageExpense: expenseCount ? Math.round(totalSpent / expenseCount) : 0,
    changePercentage: toPercent(totalSpent, previousSpent),
    categories,
    subcategories,
    projects,
    topCategory: categories[0] || null,
    topSubcategory: subcategories[0] || null,
    topProject: projects[0] || null,
  };
}

function summarizeInvestments(investments) {
  const totalInvested = investments.reduce((sum, investment) => sum + safeNumber(investment.investedAmount), 0);
  const totalCurrent = investments.reduce((sum, investment) => sum + safeNumber(investment.currentValue), 0);
  const byType = buildTopBreakdown(
    investments.map((investment) => ({
      amount: safeNumber(investment.currentValue),
      label: titleCaseLabel(investment.type || 'other'),
    })),
    (investment) => investment.label,
  );
  const topHoldings = [...investments]
    .map((investment) => ({
      label: normalizeLabel(investment.name, 'Investment'),
      amount: safeNumber(investment.currentValue),
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);

  return {
    count: investments.length,
    totalInvested,
    totalCurrent,
    gain: totalCurrent - totalInvested,
    returnPercentage: totalInvested ? Number((((totalCurrent - totalInvested) / totalInvested) * 100).toFixed(1)) : 0,
    byType,
    topHoldings,
  };
}

function summarizeGoals(goals) {
  const totalTarget = goals.reduce((sum, goal) => sum + safeNumber(goal.targetAmount), 0);
  const totalSaved = goals.reduce((sum, goal) => sum + safeNumber(goal.currentAmount), 0);

  return {
    count: goals.length,
    totalTarget,
    totalSaved,
    progressPercentage: totalTarget ? Number(((totalSaved / totalTarget) * 100).toFixed(1)) : 0,
  };
}

function summarizeLoans(loans) {
  return {
    count: loans.length,
    totalPrincipal: loans.reduce((sum, loan) => sum + safeNumber(loan.principal), 0),
    totalMonthlyEmi: loans.reduce((sum, loan) => sum + safeNumber(loan.monthlyEMI), 0),
  };
}

function buildPromptPayload({ periodLabel, expensesSummary, investmentsSummary, goalsSummary, loansSummary }) {
  return {
    period: periodLabel,
    expenses: expensesSummary,
    investments: investmentsSummary,
    goals: goalsSummary,
    loans: loansSummary,
  };
}

function sanitizeReport(aiReport) {
  return {
    summary: normalizeLabel(aiReport.summary, 'No summary returned.'),
    wins: Array.isArray(aiReport.wins) ? aiReport.wins.filter(Boolean) : [],
    risks: Array.isArray(aiReport.risks) ? aiReport.risks.filter(Boolean) : [],
    recommendations: Array.isArray(aiReport.recommendations) ? aiReport.recommendations : [],
    anomalies: Array.isArray(aiReport.anomalies) ? aiReport.anomalies : [],
    investmentInsights: Array.isArray(aiReport.investmentInsights) ? aiReport.investmentInsights.filter(Boolean) : [],
  };
}

function sanitizeAskResponse(aiResponse) {
  return {
    answer: normalizeLabel(aiResponse.answer, 'No answer returned.'),
    highlights: Array.isArray(aiResponse.highlights) ? aiResponse.highlights.filter(Boolean) : [],
    scenarioSummary: normalizeLabel(aiResponse.scenarioSummary, 'No scenario adjustments were applied.'),
  };
}

function serializeReport(id, report) {
  return {
    id,
    ...report,
    generatedAt: report.generatedAt?.toDate?.()?.toISOString?.() || '',
  };
}

async function requireUser(request, _response, next) {
  try {
    const header = request.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      throw createError(401, 'Missing Firebase ID token.');
    }

    request.user = await auth.verifyIdToken(token);
    next();
  } catch (error) {
    if (error.status) {
      next(error);
      return;
    }

    const diagnostic =
      process.env.NODE_ENV === 'production' ? '' : ` Firebase Admin verification failed: ${error.message}`;
    next(createError(401, `Invalid or expired Firebase ID token.${diagnostic}`));
  }
}

async function generateOpenAiJson({ promptPayload, schema, schemaName, systemPrompt, sanitize }) {
  if (!process.env.OPENAI_API_KEY) {
    throw createError(500, 'OPENAI_API_KEY is not configured on the AI server.');
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const aiResponse = await client.responses.create({
      model: openAiModel,
      input: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: JSON.stringify(promptPayload, null, 2),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
    });

    if (!aiResponse.output_text) {
      throw createError(502, 'OpenAI returned an empty response.');
    }

    return sanitize(JSON.parse(aiResponse.output_text));
  } catch (error) {
    logAiError('OpenAI', openAiModel, error);
    const diagnostic =
      process.env.NODE_ENV === 'production'
        ? ''
        : ` provider=openai code=${error?.code || 'unknown'} requestId=${error?.request_id || error?.headers?.['x-request-id'] || 'unknown'}`;
    throw createError(error?.status === 429 ? 429 : 502, `AI request failed.${diagnostic}`);
  }
}

async function generateGeminiJson({ promptPayload, schema, systemPrompt, sanitize }) {
  if (!process.env.GEMINI_API_KEY) {
    throw createError(500, 'GEMINI_API_KEY is not configured on the AI server.');
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
      contents: [
            {
              parts: [
                {
                  text: systemPrompt,
                },
              ],
            },
            {
              parts: [
                {
                  text: JSON.stringify(promptPayload, null, 2),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
          },
        }),
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiError = payload?.error || {};
      const error = new Error(apiError.message || 'Gemini request failed.');
      error.status = response.status;
      error.code = apiError.status || apiError.code || 'unknown';
      error.type = apiError.status || 'unknown';
      throw error;
    }

    const text = payload?.candidates?.[0]?.content?.parts?.find((part) => typeof part?.text === 'string')?.text || '';
    if (!text) {
      throw createError(502, 'Gemini returned an empty response.');
    }

    return sanitize(JSON.parse(text));
  } catch (error) {
    logAiError('Gemini', geminiModel, error);
    const diagnostic =
      process.env.NODE_ENV === 'production' ? '' : ` provider=gemini code=${error?.code || 'unknown'}`;
    throw createError(error?.status === 429 ? 429 : 502, `AI request failed.${diagnostic}`);
  }
}

async function generateOpenAiReport(promptPayload) {
  return generateOpenAiJson({
    promptPayload: {
      task: 'Create a monthly finance report from this data.',
      data: promptPayload,
    },
    schema: REPORT_SCHEMA,
    schemaName: 'monthly_finance_report',
    systemPrompt: AI_REPORT_SYSTEM_PROMPT,
    sanitize: sanitizeReport,
  });
}

async function generateGeminiReport(promptPayload) {
  return generateGeminiJson({
    promptPayload: {
      task: 'Create a monthly finance report from this data.',
      data: promptPayload,
    },
    schema: REPORT_SCHEMA,
    systemPrompt: AI_REPORT_SYSTEM_PROMPT,
    sanitize: sanitizeReport,
  });
}

async function generateProviderReport(provider, promptPayload) {
  return provider === 'gemini' ? generateGeminiReport(promptPayload) : generateOpenAiReport(promptPayload);
}

async function generateOpenAiAsk(promptPayload) {
  return generateOpenAiJson({
    promptPayload: {
      task: 'Answer the user question and analyze the what-if scenario using this finance data.',
      data: promptPayload,
    },
    schema: ASK_SCHEMA,
    schemaName: 'finance_ask_response',
    systemPrompt: AI_ASK_SYSTEM_PROMPT,
    sanitize: sanitizeAskResponse,
  });
}

async function generateGeminiAsk(promptPayload) {
  return generateGeminiJson({
    promptPayload: {
      task: 'Answer the user question and analyze the what-if scenario using this finance data.',
      data: promptPayload,
    },
    schema: ASK_SCHEMA,
    systemPrompt: AI_ASK_SYSTEM_PROMPT,
    sanitize: sanitizeAskResponse,
  });
}

async function generateProviderAsk(provider, promptPayload) {
  return provider === 'gemini' ? generateGeminiAsk(promptPayload) : generateOpenAiAsk(promptPayload);
}

function buildWhatIfScenario(scenarioInput, summaries) {
  const horizonMonths = Math.min(60, Math.max(1, Math.round(safeNumber(scenarioInput?.horizonMonths) || 12)));
  const monthlyExpenseReduction = Math.max(0, safeNumber(scenarioInput?.monthlyExpenseReduction));
  const extraMonthlyInvestment = Math.max(0, safeNumber(scenarioInput?.extraMonthlyInvestment));
  const oneTimeGoalContribution = Math.max(0, safeNumber(scenarioInput?.oneTimeGoalContribution));

  const estimatedExpenseSavings = monthlyExpenseReduction * horizonMonths;
  const estimatedAdditionalInvestment = extraMonthlyInvestment * horizonMonths;
  const projectedMonthlySpend = Math.max(0, summaries.expensesSummary.totalSpent - monthlyExpenseReduction);
  const projectedGoalSaved = summaries.goalsSummary.totalSaved + oneTimeGoalContribution;

  return {
    horizonMonths,
    monthlyExpenseReduction,
    extraMonthlyInvestment,
    oneTimeGoalContribution,
    estimatedExpenseSavings,
    estimatedAdditionalInvestment,
    projectedMonthlySpend,
    projectedGoalSaved,
    projectedGoalCoverage: summaries.goalsSummary.totalTarget
      ? Number(((projectedGoalSaved / summaries.goalsSummary.totalTarget) * 100).toFixed(1))
      : 0,
    projectedInvestedAmount: summaries.investmentsSummary.totalInvested + estimatedAdditionalInvestment,
  };
}

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((item) => item.trim()) : true,
}));
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.post('/api/ai/reports/monthly', requireUser, async (request, response, next) => {
  try {
    const provider = normalizeAiProvider(request.body?.provider);
    const { periodKey, periodLabel, startDateKey, nextMonthKey, previousMonthKey } = parsePeriodKey(request.body?.periodKey);
    const forceRefresh = Boolean(request.body?.forceRefresh);
    const reportRef = db.doc(`users/${request.user.uid}/aiReports/${provider}_${periodKey}`);
    const existingReport = await reportRef.get();

    if (existingReport.exists && !forceRefresh) {
      response.json({
        cached: true,
        report: serializeReport(existingReport.id, existingReport.data()),
      });
      return;
    }

    const currentExpensesQuery = db
      .collection(`users/${request.user.uid}/expenses`)
      .where('date', '>=', `${startDateKey}-01`)
      .where('date', '<', `${nextMonthKey}-01`);
    const previousExpensesQuery = db
      .collection(`users/${request.user.uid}/expenses`)
      .where('date', '>=', `${previousMonthKey}-01`)
      .where('date', '<', `${startDateKey}-01`);

    const [currentExpensesSnap, previousExpensesSnap, investmentsSnap, goalsSnap, loansSnap] = await Promise.all([
      currentExpensesQuery.get(),
      previousExpensesQuery.get(),
      db.collection(`users/${request.user.uid}/investments`).get(),
      db.collection(`users/${request.user.uid}/goals`).get(),
      db.collection(`users/${request.user.uid}/loans`).get(),
    ]);

    const expenses = currentExpensesSnap.docs.map((doc) => doc.data());
    if (!expenses.length) {
      throw createError(400, `No expenses found for ${periodLabel}.`);
    }

    const previousExpenses = previousExpensesSnap.docs.map((doc) => doc.data());
    const investments = investmentsSnap.docs.map((doc) => doc.data());
    const goals = goalsSnap.docs.map((doc) => doc.data());
    const loans = loansSnap.docs.map((doc) => doc.data());

    const expensesSummary = summarizeExpenses(expenses, previousExpenses);
    const investmentsSummary = summarizeInvestments(investments);
    const goalsSummary = summarizeGoals(goals);
    const loansSummary = summarizeLoans(loans);
    const promptPayload = buildPromptPayload({
      periodLabel,
      expensesSummary,
      investmentsSummary,
      goalsSummary,
      loansSummary,
    });
    const parsedReport = await generateProviderReport(provider, promptPayload);

    const reportDocument = {
      provider,
      periodKey,
      periodLabel,
      generatedAt: Timestamp.now(),
      model: getProviderModel(provider),
      summary: parsedReport.summary,
      wins: parsedReport.wins,
      risks: parsedReport.risks,
      recommendations: parsedReport.recommendations,
      anomalies: parsedReport.anomalies,
      investmentInsights: parsedReport.investmentInsights,
      metrics: {
        totalSpent: expensesSummary.totalSpent,
        previousSpent: expensesSummary.previousSpent,
        expenseCount: expensesSummary.expenseCount,
        averageExpense: expensesSummary.averageExpense,
        changePercentage: expensesSummary.changePercentage,
        topCategory: expensesSummary.topCategory,
        topSubcategory: expensesSummary.topSubcategory,
        topProject: expensesSummary.topProject,
        investmentValue: investmentsSummary.totalCurrent,
        investedAmount: investmentsSummary.totalInvested,
        investmentGain: investmentsSummary.gain,
        investmentReturnPercentage: investmentsSummary.returnPercentage,
        topInvestmentType: investmentsSummary.byType[0] || null,
        topHolding: investmentsSummary.topHoldings[0] || null,
        goalTarget: goalsSummary.totalTarget,
        goalSaved: goalsSummary.totalSaved,
        loanPrincipal: loansSummary.totalPrincipal,
        monthlyEmi: loansSummary.totalMonthlyEmi,
      },
      breakdown: {
        categories: expensesSummary.categories,
        subcategories: expensesSummary.subcategories,
        projects: expensesSummary.projects,
        investmentTypes: investmentsSummary.byType,
        holdings: investmentsSummary.topHoldings,
      },
      promptPayload,
    };

    await reportRef.set(reportDocument, { merge: true });

    response.json({
      cached: false,
      report: serializeReport(`${provider}_${periodKey}`, reportDocument),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ai/ask', requireUser, async (request, response, next) => {
  try {
    const provider = normalizeAiProvider(request.body?.provider);
    const { periodLabel, startDateKey, nextMonthKey, previousMonthKey } = parsePeriodKey(request.body?.periodKey);
    const question = String(request.body?.question || '').trim();
    const scenarioInput = request.body?.scenario || {};
    const hasScenario = ['monthlyExpenseReduction', 'extraMonthlyInvestment', 'oneTimeGoalContribution']
      .some((key) => safeNumber(scenarioInput?.[key]) > 0);

    if (!question && !hasScenario) {
      throw createError(400, 'Provide a question or at least one what-if input.');
    }

    const currentExpensesQuery = db
      .collection(`users/${request.user.uid}/expenses`)
      .where('date', '>=', `${startDateKey}-01`)
      .where('date', '<', `${nextMonthKey}-01`);
    const previousExpensesQuery = db
      .collection(`users/${request.user.uid}/expenses`)
      .where('date', '>=', `${previousMonthKey}-01`)
      .where('date', '<', `${startDateKey}-01`);

    const [currentExpensesSnap, previousExpensesSnap, investmentsSnap, goalsSnap, loansSnap] = await Promise.all([
      currentExpensesQuery.get(),
      previousExpensesQuery.get(),
      db.collection(`users/${request.user.uid}/investments`).get(),
      db.collection(`users/${request.user.uid}/goals`).get(),
      db.collection(`users/${request.user.uid}/loans`).get(),
    ]);

    const expensesSummary = summarizeExpenses(
      currentExpensesSnap.docs.map((doc) => doc.data()),
      previousExpensesSnap.docs.map((doc) => doc.data()),
    );
    const investmentsSummary = summarizeInvestments(investmentsSnap.docs.map((doc) => doc.data()));
    const goalsSummary = summarizeGoals(goalsSnap.docs.map((doc) => doc.data()));
    const loansSummary = summarizeLoans(loansSnap.docs.map((doc) => doc.data()));
    const scenario = buildWhatIfScenario(scenarioInput, {
      expensesSummary,
      investmentsSummary,
      goalsSummary,
      loansSummary,
    });

    const snapshot = buildPromptPayload({
      periodLabel,
      expensesSummary,
      investmentsSummary,
      goalsSummary,
      loansSummary,
    });

    const askPayload = {
      period: periodLabel,
      question: question || 'Review the scenario and explain the impact in plain language.',
      snapshot,
      scenario,
    };

    const result = await generateProviderAsk(provider, askPayload);

    response.json({
      provider,
      model: getProviderModel(provider),
      periodLabel,
      generatedAt: new Date().toISOString(),
      snapshot,
      scenario,
      result,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, next) => {
  void next;
  const status = error?.status || 500;
  const message = error?.message || 'Internal server error.';
  response.status(status).json({ error: message });
});

app.listen(port, () => {
  logStartupConfig();
  console.log(`AI server listening on http://localhost:${port}`);
});
