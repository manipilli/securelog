import dotenv from 'dotenv'
import crypto from 'node:crypto'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import multer from 'multer'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import nodemailer from 'nodemailer'
import { gzipSync, gunzipSync } from 'node:zlib'
import AppState from './models/AppState.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rootEnvPath = path.join(currentDir, '..', '..', '.env')
const backendEnvPath = path.join(currentDir, '..', '.env')
function loadEnvFiles() {
  if (fsSync.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath, override: true })
  if (fsSync.existsSync(backendEnvPath)) dotenv.config({ path: backendEnvPath, override: true })
}
loadEnvFiles()

const app = express()
const port = process.env.PORT || 4000
const isVercel = Boolean(process.env.VERCEL)
const localStorageRoot = path.join(currentDir, '..', 'storage')
const localDataRoot = path.join(currentDir, '..', 'data')
const bundledStateFile = path.join(localDataRoot, 'state.json')
const storageRoot = isVercel ? path.join(os.tmpdir(), 'securelog', 'storage') : localStorageRoot
const dataRoot = isVercel ? path.join(os.tmpdir(), 'securelog', 'data') : localDataRoot
const stateFile = path.join(dataRoot, 'state.json')
const users = new Map()
const challenges = new Map()
const usedChallenges = new Set()
const logs = new Map()
const alerts = new Map()
const internalWrites = new Set()
const watchTimers = new Map()
const masterKey = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'development-only-change-this-key').digest()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ['.log', '.txt', '.json', '.csv'].includes(path.extname(file.originalname).toLowerCase())),
})
const verifyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

function hmacSecret() {
  return process.env.JWT_SECRET || 'development-only-jwt-secret'
}

function signPayload(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url')
  const signature = crypto.createHmac('sha256', hmacSecret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function verifySignedPayload(token) {
  if (!token || typeof token !== 'string') return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = crypto.createHmac('sha256', hmacSecret()).update(payload).digest('base64url')
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return null
  }
}

function tokenFor(user) {
  return signPayload({
    userId: user.id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role || 'user',
    exp: Date.now() + 8 * 60 * 60 * 1000,
  })
}

function userFromToken(token) {
  const data = verifySignedPayload(token)
  if (!data || data.exp <= Date.now()) return null
  return users.get(data.userId) || (data.email ? {
    id: data.userId,
    organizationId: data.organizationId,
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    role: data.role || 'user',
  } : null)
}

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  let user = userFromToken(token)
  if (!user && process.env.MONGODB_URI) {
    await syncStateIfMongo()
    user = userFromToken(token)
  }
  if (!user) return res.status(401).json({ error: 'Sign in and complete verification first.' })
  req.user = user
  next()
}

function requireSuperAdmin(req, res, next) {
  if ((req.user?.role || 'user') !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access is required.' })
  }
  next()
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role || 'user' }
}

function sanitizeLogForUser(record) {
  const { sha256: _sha256, registeredHash: _registeredHash, ...safeRecord } = record
  return safeRecord
}

let cachedEtherealAccount = null

async function getSmtpConfig() {
  loadEnvFiles()
  const smtpHost = process.env.SMTP_HOST?.trim()
  const smtpUser = process.env.SMTP_USER?.trim()
  const rawSmtpPass = process.env.SMTP_PASSWORD?.trim()
  const smtpPass = rawSmtpPass && smtpHost?.toLowerCase().includes('gmail.com')
    ? rawSmtpPass.replace(/\s+/g, '')
    : rawSmtpPass
  const smtpPort = Number(process.env.SMTP_PORT || 587)
  const smtpFrom = process.env.SMTP_FROM?.trim() || smtpUser

  if (smtpHost && smtpUser && smtpPass) {
    return {
      host: smtpHost,
      port: smtpPort,
      secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
      user: smtpUser,
      pass: smtpPass,
      from: smtpFrom,
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    if (!cachedEtherealAccount) {
      cachedEtherealAccount = await nodemailer.createTestAccount()
    }
    return {
      host: cachedEtherealAccount.smtp.host,
      port: cachedEtherealAccount.smtp.port,
      secure: cachedEtherealAccount.smtp.secure,
      user: cachedEtherealAccount.user,
      pass: cachedEtherealAccount.pass,
      from: `SecureLog <${cachedEtherealAccount.user}>`,
    }
  }

  return null
}

async function sendMail({ to, subject, text, html, attachments, logLabel }) {
  if (!to) {
    return { status: 'skipped', reason: 'No recipient email address.' }
  }

  let smtpConfig = null
  try {
    smtpConfig = await getSmtpConfig()
  } catch (configError) {
    console.warn(`[SecureLog ${logLabel}] Could not create temporary SMTP account:`, configError.message)
  }

  if (!smtpConfig) {
    console.warn(`[SecureLog ${logLabel}] SMTP not configured. Would send to ${to}: ${subject}`)
    return {
      status: 'not_configured',
      to,
      checkedAt: new Date().toISOString(),
      reason: 'Configure SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in .env to deliver emails.',
    }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    })
    const info = await transporter.sendMail({
      from: smtpConfig.from,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
      ...(attachments?.length ? { attachments } : {}),
    })
    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined
    if (previewUrl) {
      console.log(`[SecureLog ${logLabel}] Preview URL for ${to}: ${previewUrl}`)
    }
    return {
      status: 'sent',
      to,
      sentAt: new Date().toISOString(),
      messageId: info.messageId,
      ...(previewUrl ? { previewUrl } : {}),
    }
  } catch (mailError) {
    console.error(`[SecureLog ${logLabel}] Delivery failed for ${to}:`, mailError.message)
    return {
      status: 'failed',
      to,
      attemptedAt: new Date().toISOString(),
      error: mailError.message,
    }
  }
}

function hashChallengeCode(challengeNonce, code) {
  return crypto.createHmac('sha256', hmacSecret()).update(`${challengeNonce}:${String(code || '').trim()}`).digest('hex')
}

async function issueChallenge(user, _method = 'email', { purpose = 'login', pendingUser = null } = {}) {
  const code = String(crypto.randomInt(100000, 1000000))
  const challengeNonce = crypto.randomUUID()
  const effectiveMethod = 'email'
  const expiresAt = Date.now() + 10 * 60 * 1000
  const codeHash = hashChallengeCode(challengeNonce, code)
  const challengeId = signPayload({
    id: challengeNonce,
    userId: user.id,
    method: effectiveMethod,
    purpose,
    pendingUser,
    codeHash,
    expiresAt,
  })
  challenges.set(challengeNonce, { expiresAt })
  const destination = user.email
  let emailDelivery = null
  if (effectiveMethod === 'email') {
    const isRegister = purpose === 'register'
    const subject = isRegister
      ? '[SecureLog] Verify your email to create your account'
      : '[SecureLog] Your sign-in verification OTP'
    const intro = isRegister
      ? 'Use the verification code below to confirm your email address and complete your new SecureLog account registration:'
      : 'Use the verification code below to complete your SecureLog sign-in:'
    emailDelivery = await sendMail({
      to: user.email,
      subject,
      text: [
        `Hello ${user.name || 'User'},`,
        '',
        intro,
        '',
        `Verification OTP: ${code}`,
        '',
        'This code expires in 10 minutes. Do not share it with anyone.',
      ].join('\n'),
      html: [
        `<p>Hello ${String(user.name || 'User').replace(/[<>&]/g, '')},</p>`,
        `<p>${intro}</p>`,
        `<p style="font-size:24px;font-weight:bold;letter-spacing:4px;margin:16px 0;">${code}</p>`,
        '<p>This code expires in 10 minutes. Do not share it with anyone.</p>',
      ].join(''),
      logLabel: 'OTP Email',
    })
  }
  const includeDevCode = process.env.NODE_ENV !== 'production' && emailDelivery?.status !== 'sent'
  return {
    challengeId,
    method: effectiveMethod,
    destination,
    expiresIn: 600,
    ...(emailDelivery ? { emailDelivery } : {}),
    ...(includeDevCode ? { devCode: code } : {}),
  }
}

function markInternalWrite(userId, logId) {
  const key = `${userId}/${logId}.bin`
  internalWrites.add(key)
  setTimeout(() => internalWrites.delete(key), 800)
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))
}

function buildModificationDetails(previousBuffer, modifiedBuffer) {
  if (!previousBuffer || !modifiedBuffer) return ''
  const prevLines = previousBuffer.toString('utf8').split(/\r?\n/)
  const modLines = modifiedBuffer.toString('utf8').split(/\r?\n/)
  let start = 0
  while (start < prevLines.length && start < modLines.length && prevLines[start] === modLines[start]) {
    start++
  }
  let prevEnd = prevLines.length - 1
  let modEnd = modLines.length - 1
  while (prevEnd >= start && modEnd >= start && prevLines[prevEnd] === modLines[modEnd]) {
    prevEnd--
    modEnd--
  }
  const chunks = []
  const span = Math.max(prevEnd - start + 1, modEnd - start + 1)
  for (let offset = 0; offset < span && chunks.length < 40; offset++) {
    const pIdx = start + offset
    const mIdx = start + offset
    const hasPrev = pIdx <= prevEnd
    const hasMod = mIdx <= modEnd
    if (hasPrev && hasMod) {
      if (prevLines[pIdx] === modLines[mIdx]) continue
      chunks.push(`Line ${mIdx + 1} modified:\n- Before: ${prevLines[pIdx]}\n+ After:  ${modLines[mIdx]}`)
    } else if (hasMod) {
      chunks.push(`Line ${mIdx + 1} added:\n+ ${modLines[mIdx]}`)
    } else if (hasPrev) {
      chunks.push(`Line ${pIdx + 1} removed:\n- ${prevLines[pIdx]}`)
    }
  }
  if (span > 40) {
    chunks.push(`... (${span - 40} additional changed lines; see attached file for full content)`)
  }
  const output = chunks.join('\n\n')
  return output.length > 4000 ? `${output.slice(0, 4000)}\n... (truncated; see attached file)` : output
}

function publicFrontendBaseUrl() {
  if (process.env.FRONTEND_URL?.trim()) return process.env.FRONTEND_URL.trim().replace(/\/+$/, '')
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  if (vercelHost) return `https://${vercelHost.replace(/^https?:\/\//, '')}`
  return 'http://127.0.0.1:5173'
}

async function sendSecurityAlertEmail({ recipientEmail, recipientName, record, alert, subject, summary, reason, modificationDetails = '', attachments = [] }) {
  const dashboardUrl = `${publicFrontendBaseUrl()}/dashboard`
  const text = [
    `Hello ${recipientName || 'User'},`,
    '',
    summary,
    `File: ${record.originalFileName}`,
    `Record ID: ${record.logId}`,
    `Severity: ${alert.severity}`,
    `Reason: ${reason}`,
    `Detected At: ${alert.createdAt}`,
    ...(modificationDetails ? ['', 'Exact Modification Details:', modificationDetails] : []),
    ...(attachments.length ? ['', `Attached modified file: ${attachments[0].filename}`] : []),
    '',
    `Inspect your security alerts in the dashboard: ${dashboardUrl}`,
  ].join('\n')
  const html = [
    `<p>Hello ${escapeHtml(recipientName || 'User')},</p>`,
    `<p><strong>${escapeHtml(summary)}</strong></p>`,
    '<ul>',
    `<li><strong>File:</strong> ${escapeHtml(record.originalFileName)}</li>`,
    `<li><strong>Record ID:</strong> ${escapeHtml(record.logId)}</li>`,
    `<li><strong>Severity:</strong> ${escapeHtml(alert.severity)}</li>`,
    `<li><strong>Reason:</strong> ${escapeHtml(reason)}</li>`,
    `<li><strong>Detected At:</strong> ${escapeHtml(alert.createdAt)}</li>`,
    '</ul>',
    ...(modificationDetails
      ? [
          '<p><strong>Exact Modification Details:</strong></p>',
          `<pre style="background:#f4f7f1;border:1px solid #cddac8;padding:12px;font-family:Consolas,monospace;font-size:13px;white-space:pre-wrap;">${escapeHtml(modificationDetails)}</pre>`,
        ]
      : []),
    ...(attachments.length ? [`<p><strong>Attached modified file:</strong> ${escapeHtml(attachments[0].filename)}</p>`] : []),
    `<p>Inspect your security alerts in the dashboard: <a href="${dashboardUrl}">${dashboardUrl}</a></p>`,
  ].join('')
  return sendMail({ to: recipientEmail, subject, text, html, attachments, logLabel: 'Email Alert' })
}

async function verifyRecordIntegrity(record, { candidateBuffer, previousBuffer, modifiedBuffer, modifiedFileName, reason, actorEmail, isWatcher = false } = {}) {
  let currentHash = null
  let tamperReason = ''
  if (candidateBuffer) {
    currentHash = crypto.createHash('sha256').update(candidateBuffer).digest('hex')
    if (currentHash !== record.registeredHash) {
      tamperReason = reason || 'Local file contents were modified and no longer match the registered record.'
    }
  } else {
    try {
      const decrypted = await decryptFromPrivateStorage(record)
      currentHash = crypto.createHash('sha256').update(decrypted).digest('hex')
      if (currentHash !== record.registeredHash) {
        tamperReason = reason || 'Decrypted payload hash does not match the registered fingerprint.'
      }
    } catch (decryptError) {
      tamperReason = reason || (decryptError.code === 'ENOENT' ? 'Stored encrypted file was deleted or missing from storage.' : 'Stored encrypted file or authentication tag was modified.')
    }
  }

  const now = new Date().toISOString()
  if (!tamperReason && currentHash === record.registeredHash) {
    record.status = 'VERIFIED'
    await persistState()
    return { logId: record.logId, result: 'VERIFIED', verifiedAt: now }
  }

  const existingAlert = alerts.get(record.logId)
  if (isWatcher && existingAlert && Date.now() - new Date(existingAlert.createdAt).getTime() < 5000) {
    return { logId: record.logId, result: 'TAMPERED', verifiedAt: existingAlert.createdAt, alert: existingAlert }
  }

  const activeModifiedBuffer = modifiedBuffer || candidateBuffer || null
  const modificationDetails = previousBuffer && activeModifiedBuffer
    ? buildModificationDetails(previousBuffer, activeModifiedBuffer)
    : ''
  const attachments = activeModifiedBuffer
    ? [{ filename: modifiedFileName || record.originalFileName, content: activeModifiedBuffer }]
    : []

  record.status = 'TAMPERED'
  const owner = users.get(record.userId)
  const recipientEmail = owner?.email || actorEmail || ''
  const alert = {
    logId: record.logId,
    organizationId: record.organizationId,
    severity: 'CRITICAL',
    type: 'TAMPER_DETECTED',
    message: `File modification detected for ${record.originalFileName}. ${tamperReason}`,
    ...(modificationDetails ? { modificationDetails: modificationDetails.slice(0, 1000) } : {}),
    createdAt: now,
    status: 'OPEN',
    recipientEmail,
  }
  alert.emailNotification = await sendSecurityAlertEmail({
    recipientEmail,
    recipientName: owner?.name,
    record,
    alert,
    subject: `[SecureLog ALERT] File modification detected: ${record.originalFileName}`,
    summary: 'SecureLog detected that a monitored file has been modified or failed integrity verification.',
    reason: tamperReason,
    modificationDetails,
    attachments,
  })
  alerts.set(record.logId, alert)
  await persistState()
  return { logId: record.logId, result: 'TAMPERED', verifiedAt: now, alert, emailNotification: alert.emailNotification }
}

async function encryptToPrivateStorage(userId, logId, buffer) {
  const compressed = gzipSync(buffer, { level: 9 })
  const payload = compressed.length < buffer.length ? compressed : buffer
  const compression = payload === compressed ? 'gzip' : 'none'
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv)
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()])
  const tag = cipher.getAuthTag()
  markInternalWrite(userId, logId)
  await fs.mkdir(path.join(storageRoot, userId), { recursive: true })
  await fs.writeFile(path.join(storageRoot, userId, `${logId}.bin`), Buffer.concat([iv, tag, ciphertext]))
  return { compression, compressedSize: payload.length, encryptedSize: iv.length + tag.length + ciphertext.length }
}

async function decryptFromPrivateStorage(record) {
  const encrypted = await fs.readFile(path.join(storageRoot, record.userId, `${record.logId}.bin`))
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, encrypted.subarray(0, 12))
  decipher.setAuthTag(encrypted.subarray(12, 28))
  const payload = Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()])
  return record.compression === 'gzip' ? gunzipSync(payload) : payload
}

async function persistState() {
  const state = { users: [...users.values()], logs: [...logs.values()], alerts: [...alerts.values()] }
  if (process.env.MONGODB_URI) {
    await AppState.findByIdAndUpdate('securelog', state, { upsert: true, setDefaultsOnInsert: true })
    return
  }
  await fs.mkdir(dataRoot, { recursive: true })
  const temporaryFile = `${stateFile}.tmp`
  await fs.writeFile(temporaryFile, JSON.stringify(state))
  await fs.rename(temporaryFile, stateFile)
}

async function loadState() {
  let state
  if (process.env.MONGODB_URI) {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    }
    state = await AppState.findById('securelog').lean()
  } else {
    try {
      state = JSON.parse(await fs.readFile(stateFile, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      if (isVercel && stateFile !== bundledStateFile) {
        try {
          state = JSON.parse(await fs.readFile(bundledStateFile, 'utf8'))
        } catch (bundledError) {
          if (bundledError.code !== 'ENOENT') throw bundledError
        }
      }
    }
  }
  if (!state) return
  for (const user of state.users || []) users.set(user.id, user)
  for (const log of state.logs || []) logs.set(log.logId, log)
  for (const alert of state.alerts || []) alerts.set(alert.logId, alert)
}

async function syncStateIfMongo() {
  if (process.env.MONGODB_URI) {
    await loadState()
  }
}

const allowedOrigins = [
  process.env.CORS_ORIGIN || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
]

app.use(helmet())
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '12mb' }))
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'securelog-api', mode: 'prototype', metadataStore: process.env.MONGODB_URI ? 'mongodb' : 'local-file' }))

app.post('/api/auth/register', async (req, res) => {
  await syncStateIfMongo()
  const { name, email, phone, password, role = 'user', adminInviteCode } = req.body
  const normalizedEmail = String(email || '').toLowerCase().trim()
  if (!name?.trim() || !normalizedEmail || !password || password.length < 12) {
    return res.status(400).json({ error: 'Name, email, and a password of at least 12 characters are required.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address to receive your verification OTP.' })
  }
  if (!['user', 'super_admin'].includes(role)) return res.status(400).json({ error: 'Choose a supported account role.' })
  if (role === 'super_admin' && process.env.SUPER_ADMIN_INVITE_CODE && adminInviteCode !== process.env.SUPER_ADMIN_INVITE_CODE) {
    return res.status(403).json({ error: 'Valid super admin invite code is required.' })
  }
  if ([...users.values()].some(user => user.email === normalizedEmail)) return res.status(409).json({ error: 'An account with this email already exists.' })
  const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
  const assignedRole = superAdminEmails.includes(normalizedEmail) ? 'super_admin' : role
  const pendingUser = {
    id: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    phone: phone || '',
    role: assignedRole,
    emailVerified: false,
    passwordHash: await bcrypt.hash(password, 12),
  }
  const challengePayload = await issueChallenge(pendingUser, 'email', { purpose: 'register', pendingUser })
  res.status(201).json({ user: publicUser(pendingUser), purpose: 'register', ...challengePayload })
})

app.post('/api/auth/login', async (req, res) => {
  await syncStateIfMongo()
  const email = String(req.body.email || '').toLowerCase().trim()
  const user = [...users.values()].find(candidate => candidate.email === email)
  if (!user) {
    if (isVercel && !process.env.MONGODB_URI) {
      return res.status(401).json({ error: 'Account not found on this serverless instance because MONGODB_URI is not configured in Vercel. Add MONGODB_URI for persistent login, or register again.' })
    }
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  }
  if (!(await bcrypt.compare(req.body.password || '', user.passwordHash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  }
  const challengePayload = await issueChallenge(user, 'email', { purpose: 'login' })
  res.json({ user: publicUser(user), purpose: 'login', ...challengePayload })
})

app.post('/api/auth/resend-code', async (req, res) => {
  await syncStateIfMongo()
  const challenge = verifySignedPayload(req.body.challengeId)
  if (!challenge || usedChallenges.has(challenge.id)) {
    return res.status(404).json({ error: 'Verification session expired or not found. Please start again.' })
  }
  const targetUser = challenge.pendingUser || users.get(challenge.userId)
  if (!targetUser) {
    return res.status(404).json({ error: 'The account for this verification request no longer exists.' })
  }
  usedChallenges.add(challenge.id)
  challenges.delete(challenge.id)
  const challengePayload = await issueChallenge(targetUser, challenge.method, {
    purpose: challenge.purpose || 'login',
    pendingUser: challenge.pendingUser || null,
  })
  res.json({ user: publicUser(targetUser), purpose: challenge.purpose || 'login', ...challengePayload })
})

app.post('/api/auth/verify-code', async (req, res) => {
  await syncStateIfMongo()
  const challenge = verifySignedPayload(req.body.challengeId)
  const submittedCodeHash = challenge?.id ? hashChallengeCode(challenge.id, req.body.code) : ''
  const codeMatches = Boolean(
    challenge
    && !usedChallenges.has(challenge.id)
    && challenge.expiresAt >= Date.now()
    && typeof challenge.codeHash === 'string'
    && submittedCodeHash.length === challenge.codeHash.length
    && crypto.timingSafeEqual(Buffer.from(submittedCodeHash), Buffer.from(challenge.codeHash))
  )
  if (!codeMatches) {
    return res.status(401).json({ error: 'That verification code is invalid or expired.' })
  }
  let user
  if (challenge.pendingUser) {
    if ([...users.values()].some(existing => existing.email === challenge.pendingUser.email)) {
      usedChallenges.add(challenge.id)
      challenges.delete(challenge.id)
      return res.status(409).json({ error: 'An account with this email already exists.' })
    }
    user = { ...challenge.pendingUser, emailVerified: true }
    users.set(user.id, user)
    await persistState()
  } else {
    user = users.get(challenge.userId)
    if (!user) return res.status(401).json({ error: 'The account for this verification request no longer exists.' })
  }
  usedChallenges.add(challenge.id)
  challenges.delete(challenge.id)
  res.json({ token: tokenFor(user), user: publicUser(user) })
})
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }))

app.post('/api/logs/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload a .log, .txt, .json, or .csv file.' })
  const logId = `SL-${crypto.randomUUID()}`
  const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex')
  const stored = await encryptToPrivateStorage(req.user.id, logId, req.file.buffer)
  const record = { logId, userId: req.user.id, organizationId: req.user.organizationId, originalFileName: req.file.originalname, fileSize: req.file.size, compressedSize: stored.compressedSize, encryptedSize: stored.encryptedSize, compression: stored.compression, storageSavingsPercent: Math.max(0, Number(((1 - stored.encryptedSize / Math.max(1, req.file.size)) * 100).toFixed(1))), mimeType: req.file.mimetype, sha256, registeredHash: sha256, encryptionAlgorithm: 'AES-256-GCM', status: 'REGISTERED', uploadedAt: new Date().toISOString() }
  logs.set(logId, record)
  await persistState()
  res.status(201).json({ ...sanitizeLogForUser(record), storage: `Private encrypted storage; ${record.storageSavingsPercent}% smaller than original` })
})
app.get('/api/logs', requireAuth, (req, res) => res.json({ logs: [...logs.values()].filter(log => log.organizationId === req.user.organizationId).map(sanitizeLogForUser) }))
app.get('/api/admin/hashes', requireAuth, requireSuperAdmin, (_req, res) => {
  const hashes = [...logs.values()]
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    .map(record => {
      const owner = users.get(record.userId)
      return {
        logId: record.logId,
        originalFileName: record.originalFileName,
        status: record.status,
        sha256: record.sha256,
        encryptionAlgorithm: record.encryptionAlgorithm,
        uploadedAt: record.uploadedAt,
        ownerName: owner?.name || 'Unknown',
        ownerEmail: owner?.email || '',
      }
    })
  res.json({ hashes })
})
app.delete('/api/logs/:logId', requireAuth, async (req, res) => {
  const record = logs.get(req.params.logId)
  if (!record || record.userId !== req.user.id) return res.status(404).json({ error: 'Log not found.' })
  const previousStatus = record.status
  markInternalWrite(record.userId, record.logId)
  await fs.rm(path.join(storageRoot, record.userId, `${record.logId}.bin`), { force: true })
  logs.delete(record.logId)
  const now = new Date().toISOString()
  const owner = users.get(record.userId)
  const recipientEmail = owner?.email || req.user.email || ''
  const reason = previousStatus === 'VERIFIED'
    ? 'Verified file was deleted from the workspace.'
    : 'Registered file was deleted from the workspace.'
  const alert = {
    logId: record.logId,
    organizationId: record.organizationId,
    severity: 'CRITICAL',
    type: 'FILE_DELETED',
    message: `File ${record.originalFileName} (${previousStatus}) was deleted.`,
    createdAt: now,
    status: 'OPEN',
    recipientEmail,
  }
  const emailNotification = await sendSecurityAlertEmail({
    recipientEmail,
    recipientName: owner?.name || req.user.name,
    record,
    alert,
    subject: `[SecureLog ALERT] File deleted: ${record.originalFileName}`,
    summary: 'SecureLog detected that a monitored file was deleted from your workspace.',
    reason,
  })
  alert.emailNotification = emailNotification
  alerts.set(record.logId, alert)
  await persistState()
  res.json({ deleted: true, logId: record.logId, emailNotification })
})
app.get('/api/logs/:logId/content', requireAuth, async (req, res) => {
  const record = logs.get(req.params.logId)
  if (!record || record.organizationId !== req.user.organizationId) return res.status(404).json({ error: 'Log not found.' })
  try {
    const decrypted = await decryptFromPrivateStorage(record)
    res.json({
      logId: record.logId,
      originalFileName: record.originalFileName,
      status: record.status,
      content: decrypted.toString('utf8'),
    })
  } catch (decryptError) {
    res.status(409).json({
      error: decryptError.code === 'ENOENT'
        ? 'The stored encrypted file is missing from storage and cannot be opened.'
        : 'The stored encrypted file is corrupted on disk and cannot be decrypted.',
    })
  }
})
app.put('/api/logs/:logId/content', requireAuth, async (req, res) => {
  const record = logs.get(req.params.logId)
  if (!record || record.organizationId !== req.user.organizationId) return res.status(404).json({ error: 'Log not found.' })
  if (typeof req.body?.content !== 'string') return res.status(400).json({ error: 'File content text is required.' })
  const modifiedBuffer = Buffer.from(req.body.content, 'utf8')
  if (modifiedBuffer.length > 10 * 1024 * 1024) return res.status(413).json({ error: 'File exceeds the 10 MB limit.' })
  const previousBuffer = await decryptFromPrivateStorage(record).catch(() => null)
  const stored = await encryptToPrivateStorage(record.userId, record.logId, modifiedBuffer)
  record.compression = stored.compression
  record.compressedSize = stored.compressedSize
  record.encryptedSize = stored.encryptedSize
  record.fileSize = modifiedBuffer.length
  const verification = await verifyRecordIntegrity(record, {
    previousBuffer,
    modifiedBuffer,
    modifiedFileName: record.originalFileName,
    actorEmail: req.user.email,
    reason: 'Opened file contents were modified in the dashboard.',
  })
  res.json({
    logId: verification.logId,
    result: verification.result,
    verifiedAt: verification.verifiedAt,
    alert: verification.alert,
    emailNotification: verification.emailNotification,
  })
})
app.post('/api/logs/:logId/verify', requireAuth, verifyUpload.single('file'), async (req, res) => {
  const record = logs.get(req.params.logId)
  if (!record || record.organizationId !== req.user.organizationId) return res.status(404).json({ error: 'Log not found.' })
  try {
    const previousBuffer = req.file?.buffer ? await decryptFromPrivateStorage(record).catch(() => null) : null
    const verification = await verifyRecordIntegrity(record, {
      candidateBuffer: req.file?.buffer,
      previousBuffer,
      modifiedFileName: req.file?.originalname || record.originalFileName,
      actorEmail: req.user.email,
    })
    res.json({
      logId: verification.logId,
      result: verification.result,
      verifiedAt: verification.verifiedAt,
      emailNotification: verification.emailNotification,
    })
  } catch { res.status(500).json({ error: 'The encrypted record could not be verified.' }) }
})
app.get('/api/alerts', requireAuth, (req, res) => {
  const visibleAlerts = [...alerts.values()]
    .filter(alert => (req.user?.role || 'user') === 'super_admin' || (alert.organizationId || logs.get(alert.logId)?.organizationId) === req.user.organizationId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  res.json({ alerts: visibleAlerts })
})
app.get('/api/dashboard/stats', requireAuth, (req, res) => {
  const ownLogs = [...logs.values()].filter(log => log.organizationId === req.user.organizationId)
  res.json({ totalLogs: ownLogs.length, verified: ownLogs.filter(log => log.status === 'VERIFIED').length, tampered: ownLogs.filter(log => log.status === 'TAMPERED').length, activeAlerts: [...alerts.values()].filter(alert => (alert.organizationId || logs.get(alert.logId)?.organizationId) === req.user.organizationId && alert.status === 'OPEN').length, blockchainTransactions: 0, organizations: 1, apiRequests: 0 })
})
app.post('/api/v1/logs/ingest', (_req, res) => res.status(501).json({ error: 'API client ingestion will be enabled after organization credentials are configured.' }))
app.use((error, _req, res, _next) => { if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File exceeds the 10 MB limit.' }); res.status(400).json({ error: 'The request could not be processed.' }) })
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))
async function ensureSuperAdminAccount() {
  const email = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@gmail.com').toLowerCase().trim()
  const password = process.env.SUPER_ADMIN_PASSWORD || 'superadmin@gmail.com'
  const existing = [...users.values()].find(candidate => candidate.email === email)
  if (existing) {
    if (existing.role !== 'super_admin') {
      existing.role = 'super_admin'
      await persistState()
    }
    return
  }
  const superAdmin = {
    id: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    name: 'Super Admin',
    email,
    phone: '',
    role: 'super_admin',
    passwordHash: await bcrypt.hash(password, 12),
  }
  users.set(superAdmin.id, superAdmin)
  await persistState()
}

function startStorageWatcher() {
  try {
    fsSync.watch(storageRoot, { recursive: true }, (_eventType, filename) => {
      if (!filename || !filename.endsWith('.bin')) return
      const normalized = filename.replace(/\\/g, '/')
      if (internalWrites.has(normalized)) return
      const logId = path.basename(normalized, '.bin')
      const record = logs.get(logId)
      if (!record) return
      clearTimeout(watchTimers.get(logId))
      watchTimers.set(logId, setTimeout(() => {
        watchTimers.delete(logId)
        verifyRecordIntegrity(record, {
          isWatcher: true,
        }).catch(error => console.error('[SecureLog Watcher]', error.message))
      }, 350))
    })
  } catch (watchError) {
    console.warn('[SecureLog Watcher] Storage watcher unavailable:', watchError.message)
  }
}

await fs.mkdir(storageRoot, { recursive: true })
await loadState()
await ensureSuperAdminAccount()
if (!isVercel) {
  startStorageWatcher()
  app.listen(port, '127.0.0.1', () => console.log(`SecureLog API listening on http://127.0.0.1:${port}`))
}

export default app
