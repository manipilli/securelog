import { useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, BarChart3, Bell, Blocks, Check, ChevronRight, CircleHelp, ClipboardCheck, Database, Fingerprint, KeyRound, LockKeyhole, Menu, Network, Search, ShieldCheck, Upload, X } from 'lucide-react'

const apiBase = import.meta.env.VITE_API_URL || ''

function requestErrorMessage(error) {
  if (error instanceof TypeError) return 'Cannot reach the SecureLog API. Start the frontend and API with "npm run dev" from the project root, then try again.'
  return error.message || 'The request could not be completed.'
}

async function readJsonResponse(response) {
  const raw = await response.text()
  if (!raw) {
    throw new Error(import.meta.env.DEV
      ? 'Cannot reach the SecureLog backend API on port 4000 (empty response). Start both frontend and backend with "npm run dev" from the project root.'
      : `Empty response from SecureLog API (HTTP ${response.status}).`)
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`Unexpected response from SecureLog API (HTTP ${response.status}).`)
  }
}

const features = [
  { icon: Blocks, title: 'Blockchain integrity', text: 'Anchor a log fingerprint on a controlled ledger without exposing its contents.' },
  { icon: LockKeyhole, title: 'AES-256-GCM encryption', text: 'Protect stored payloads with authenticated encryption and unique nonces.' },
  { icon: Fingerprint, title: 'SHA-256 verification', text: 'Recalculate a canonical fingerprint whenever a record needs checking.' },
  { icon: Bell, title: 'Tamper detection', text: 'Turn a mismatch into an alert, audit event, and optional notification.' },
  { icon: KeyRound, title: 'Organization-scoped access', text: 'Keep people, logs, and API clients inside the right organization boundary.' },
  { icon: ClipboardCheck, title: 'Audit-ready trails', text: 'Record who verified what, when, from where, and with which result.' },
]
const steps = ['Receive a log', 'Generate its SHA-256 fingerprint', 'Encrypt with AES-256-GCM', 'Store the encrypted payload', 'Register the proof on-chain', 'Verify on demand', 'Detect a mismatch', 'Notify authorized users']
const useCases = ['Education', 'Finance', 'Healthcare', 'Government', 'Cloud platforms', 'Enterprise', 'Software teams', 'Research']

function Header() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const links = [['Product', '/features'], ['How it works', '/how-it-works'], ['Use cases', '/use-cases'], ['Security', '/security'], ['API', '/api']]
  return <header className="site-header"><Link className="brand" to="/"><span className="brand-mark"><ShieldCheck size={19} /></span><span>SecureLog</span></Link><button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button><nav className={open ? 'nav open' : 'nav'}>{links.map(([label, path]) => <Link className={location.pathname === path ? 'active' : ''} onClick={() => setOpen(false)} key={path} to={path}>{label}</Link>)}<Link className="nav-verify" to="/verify">Verify a log <ArrowUpRight size={15} /></Link><Link className="nav-login" to="/login">Sign in</Link></nav></header>
}

function Footer() { return <footer><div className="footer-main"><div><Link className="brand" to="/"><span className="brand-mark"><ShieldCheck size={19} /></span><span>SecureLog</span></Link><p className="footer-copy">A practical foundation for trusted, auditable, tamper-evident records.</p></div><div className="footer-links"><div><b>Explore</b><Link to="/features">Features</Link><Link to="/security">Security</Link><Link to="/api">API docs</Link></div><div><b>Company</b><Link to="/about">About</Link><Link to="/contact">Contact</Link><Link to="/faq">FAQ</Link></div></div></div><div className="footer-bottom"><span>© 2026 SecureLog prototype</span><span>Designed for clarity. Built for verification.</span></div></footer> }

function Home() { return <><Header /><main><section className="hero section-pad"><div className="hero-copy"><div className="eyebrow"><span className="status-dot" /> Integrity infrastructure for serious systems</div><h1>Secure your logs.<br /><em>Verify every record.</em></h1><p className="hero-lede">Blockchain-powered log integrity verification for organizations that need trusted, auditable, and tamper-evident records.</p><div className="hero-actions"><Link className="button primary" to="/register">Get started <ArrowUpRight size={17} /></Link><Link className="button secondary" to="/verify">Verify a log <Search size={16} /></Link></div><div className="hero-note"><Check size={15} /> No claims of absolute security. Just evidence you can inspect.</div></div><Architecture /></section><section className="signal-strip"><div><strong>01</strong><span>Confidentiality</span><small>AES-256-GCM</small></div><div><strong>02</strong><span>Integrity</span><small>SHA-256 + blockchain</small></div><div><strong>03</strong><span>Accountability</span><small>Audit trails</small></div><div><strong>04</strong><span>Response</span><small>Alerts in real time</small></div></section><section className="section-pad features-section"><SectionIntro eyebrow="Built for evidence" title="Security primitives, composed with care." text="SecureLog connects cryptography, controlled storage, and an immutable integrity reference into one workflow your team can actually explain." /><div className="feature-grid">{features.map(({icon: Icon, title, text}) => <article className="feature-card" key={title}><div className="icon-box"><Icon size={20} /></div><h3>{title}</h3><p>{text}</p><Link to="/features">Explore <ChevronRight size={15} /></Link></article>)}</div></section><section className="workflow-section"><div className="section-pad"><SectionIntro eyebrow="The workflow" title="A record leaves a trail you can follow." text="From ingestion to verification, every important transition has a place in the system and a corresponding audit event." /><div className="steps-grid">{steps.map((step, index) => <div className="step" key={step}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></div>)}</div></div></section><section className="section-pad use-section"><div className="use-callout"><div><div className="eyebrow">One foundation, many contexts</div><h2>Make log integrity a shared language.</h2><p>Designed for teams that need to demonstrate what happened without revealing everything that was stored.</p></div><Link className="button dark" to="/use-cases">See use cases <ArrowUpRight size={17} /></Link></div><div className="use-list">{useCases.map((useCase, i) => <Link to="/use-cases" key={useCase}><span>0{i + 1}</span>{useCase}<ArrowUpRight size={15} /></Link>)}</div></section></main><Footer /></> }

const primitiveDetails = [
  ['Blockchain integrity', 'Stores a compact proof of a record, not the private file. It gives investigators a shared reference for when a fingerprint was registered.'],
  ['AES-256-GCM encryption', 'Encrypts file content before it enters private storage. The unique nonce and authentication tag help detect altered ciphertext.'],
  ['SHA-256 verification', 'Converts the canonical file bytes into a deterministic fingerprint. The same file produces the same value; a changed file produces a different one.'],
  ['Tamper detection', 'Compares the current fingerprint with the registered fingerprint and creates a detailed alert when they differ.'],
  ['Organization-scoped access', 'Keeps account, file, alert, and audit data within its owner boundary. Authorization is enforced by the backend.'],
  ['Audit-ready trails', 'Records verification activity with the record, result, timestamp, and responsible account for investigation.'],
]
const workflowDetails = [
  ['Receive a log', 'A user or configured application sends a supported record to SecureLog.'],
  ['Generate its SHA-256 fingerprint', 'The backend hashes the original bytes before encryption or storage.'],
  ['Encrypt with AES-256-GCM', 'The content is protected with a unique nonce and authentication tag.'],
  ['Store the encrypted payload', 'Only encrypted bytes and safe metadata are kept in private storage.'],
  ['Register the proof on-chain', 'The integrity proof can be anchored without publishing confidential content.'],
  ['Verify on demand', 'A user requests a fresh hash and compares it with the registered value.'],
  ['Detect a mismatch', 'A difference is marked tampered and linked to the affected record.'],
  ['Notify authorized users', 'The dashboard surfaces the alert for the account responsible for the record.'],
]
const useCaseDetails = [['Education', 'Protect research, assessment, and system activity records.'], ['Finance', 'Support investigation of transaction and service logs.'], ['Healthcare', 'Keep sensitive operational records encrypted and auditable.'], ['Government', 'Create a clear integrity trail for public-service systems.'], ['Cloud platforms', 'Give distributed services a common ingestion and verification path.'], ['Enterprise', 'Help security teams investigate records across departments.'], ['Software teams', 'Verify release, access, and application event logs.'], ['Research', 'Preserve evidence provenance without exposing full source data.']]

function DetailedHome() { return <><Header /><main><section className="hero section-pad"><div className="hero-copy"><div className="eyebrow"><span className="status-dot" /> Integrity infrastructure for serious systems</div><h1>Secure your logs.<br /><em>Verify every record.</em></h1><p className="hero-lede">Blockchain-powered log integrity verification for organizations that need trusted, auditable, and tamper-evident records.</p><div className="hero-actions"><Link className="button primary" to="/register">Create an account <ArrowUpRight size={17} /></Link><Link className="button secondary" to="/login">Sign in <KeyRound size={16} /></Link></div><div className="hero-note"><Check size={15} /> Learn how the system works before creating an account.</div></div><Architecture /></section><section className="section-pad features-section"><SectionIntro eyebrow="Understand the foundation" title="What each security primitive does." text="SecureLog uses familiar security mechanisms together. Each one has a distinct job, so your team can inspect the chain instead of trusting a black box." /><div className="explanation-grid">{primitiveDetails.map(([title, text], index) => <article className="explanation-card" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section><section className="workflow-section"><div className="section-pad"><SectionIntro eyebrow="The workflow" title="A record leaves a trail you can follow." text="Every step has a purpose, from receiving the file to notifying the account that owns the record." /><div className="explanation-grid workflow-details">{workflowDetails.map(([title, text], index) => <article className="explanation-card" key={title}><span>{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section><section className="section-pad use-section"><SectionIntro eyebrow="One foundation, many contexts" title="Make log integrity a shared language." text="Different environments have different records, but the need for inspectable evidence is shared." /><div className="use-detail-grid">{useCaseDetails.map(([title, text]) => <article key={title}><span>{title}</span><p>{text}</p></article>)}</div><div className="home-auth-cta"><div><div className="eyebrow">Ready to inspect your own records?</div><h2>Create an account or sign in.</h2><p>Your dashboard will guide you through OTP verification, encrypted upload, fingerprinting, and alerts.</p></div><div className="hero-actions"><Link className="button dark" to="/register">Create account <ArrowUpRight size={16} /></Link><Link className="button secondary" to="/login">Sign in <KeyRound size={16} /></Link></div></div></section></main><Footer /></> }

function Architecture() { return <div className="architecture"><div className="arch-header"><span>SECURELOG / REFERENCE FLOW</span><span className="live-label"><span className="status-dot" /> LIVE MODEL</span></div><div className="arch-flow"><ArchNode icon={Database} label="Application" /><div className="flow-line" /><ArchNode icon={Network} label="SecureLog API" accent /><div className="flow-line" /><ArchNode icon={LockKeyhole} label="Encrypt + hash" /><div className="flow-line" /><ArchNode icon={Blocks} label="Blockchain" accent /><div className="flow-line" /><ArchNode icon={ShieldCheck} label="Verify" success /></div><div className="arch-alert"><span><Bell size={16} /> Tamper detection</span><b>→</b><span className="alert-pill">Alert authorized users</span></div></div> }
function ArchNode({ icon: Icon, label, accent, success }) { return <div className={'arch-node ' + (accent ? 'accent ' : '') + (success ? 'success' : '')}><Icon size={18} /><span>{label}</span></div> }
function SectionIntro({ eyebrow, title, text }) { return <div className="section-intro"><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{text}</p></div> }
function GenericPage({ title, eyebrow, text, children }) { return <><Header /><main className="generic-page section-pad"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="generic-lede">{text}</p>{children || <div className="generic-panel"><ShieldCheck size={28} /><h2>Built around inspectable evidence</h2><p>SecureLog is an academic prototype. The next layer is the independent API, storage service, and local Hardhat registry documented in this workspace.</p><Link className="button primary" to="/register">Start with an organization <ArrowUpRight size={16} /></Link></div>}</main><Footer /></> }
function Verify() { const [id, setId] = useState(''); const [submitted, setSubmitted] = useState(false); return <><Header /><main className="verify-page section-pad"><div className="verify-card"><div className="eyebrow">Public verification</div><h1>Check a record.<br /><em>See the evidence.</em></h1><p>Enter a public verification ID to view safe integrity metadata. Confidential log content is never exposed here.</p><div className="verify-form"><input value={id} onChange={e => setId(e.target.value)} placeholder="e.g. SL-VFY-2026-0001" aria-label="Verification ID" /><button className="button primary" disabled={!id} onClick={() => setSubmitted(true)}>Verify <Search size={16} /></button></div>{submitted && <div className="verify-result"><div className="result-icon"><Check size={20} /></div><div><b>Verification request received</b><span>Live results will appear when the backend is connected for <strong>{id}</strong>.</span></div></div>}<div className="safe-fields"><span><Check size={14} /> Verification ID</span><span><Check size={14} /> Registration timestamp</span><span><Check size={14} /> Integrity result</span></div></div></main><Footer /></> }
function Login({ register = false }) {
  const navigate = useNavigate()
  const greeting = new Date().getHours() < 12 ? 'Good morning.' : new Date().getHours() < 18 ? 'Good afternoon.' : 'Good evening.'
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'user' })
  const [challenge, setChallenge] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  useEffect(() => {
    setChallenge(null)
    setCode('')
    setError('')
    setStatusMessage('')
    setSubmitting(false)
    setResending(false)
  }, [register])
  const submit = async event => {
    event.preventDefault(); setError(''); setStatusMessage(''); setSubmitting(true)
    try {
      const response = await fetch(`${apiBase}/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const body = await readJsonResponse(response)
      if (!response.ok) throw new Error(body.error)
      setChallenge(body)
      setCode('')
    } catch (requestError) { setError(requestErrorMessage(requestError)) }
    finally { setSubmitting(false) }
  }
  const resendOtp = async () => {
    if (!challenge?.challengeId) return
    setError(''); setStatusMessage(''); setResending(true)
    try {
      const response = await fetch(`${apiBase}/api/auth/resend-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId: challenge.challengeId }) })
      const body = await readJsonResponse(response)
      if (!response.ok) throw new Error(body.error)
      setChallenge(body)
      setCode('')
      setStatusMessage(body.emailDelivery?.status === 'sent' ? `A new OTP was sent to ${body.emailDelivery.to}.` : 'A new verification code was generated.')
    } catch (requestError) { setError(requestErrorMessage(requestError)) }
    finally { setResending(false) }
  }
  const verify = async event => {
    event.preventDefault(); setError(''); setStatusMessage(''); setSubmitting(true)
    try {
      const response = await fetch(`${apiBase}/api/auth/verify-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId: challenge.challengeId, code }) })
      const body = await readJsonResponse(response)
      if (!response.ok) throw new Error(body.error)
      localStorage.setItem('securelog_token', body.token)
      setChallenge(null)
      setCode('')
      navigate('/dashboard')
    } catch (requestError) { setError(requestErrorMessage(requestError)) }
    finally { setSubmitting(false) }
  }
  return <><Header /><main className="auth-page section-pad"><div className="auth-card"><div className="eyebrow">{challenge ? 'Email verification' : register ? 'Create workspace' : 'Secure access'}</div><h1>{challenge ? `${greeting} Confirm your email.` : register ? 'Start with a trusted record.' : `${greeting} Welcome back.`}</h1><p>{challenge ? `Enter the 6-digit OTP sent to ${challenge.destination} to ${register ? 'verify your email and finish creating your account' : 'complete sign-in'}. It expires in 10 minutes.` : register ? 'Create an account for your tamper-evident log workflow. We will send an OTP to your email address.' : 'Sign in to inspect logs, alerts, and verification history. A 6-digit OTP will be sent to your email.'}</p>{!challenge ? <form onSubmit={submit}>{register && <label>Your name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required placeholder="Your name" /></label>}<label>Work email<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required placeholder="you@company.com" /><span className="field-note">{register ? 'Your account creation OTP will be sent to this email address.' : 'Your sign-in verification OTP will be sent to this email address.'}</span></label>{register && <label>Phone number <span className="field-note">optional</span><input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="+1 555 000 0000" /></label>}<label>Password<input type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} required minLength="12" placeholder="At least 12 characters" /></label>{register && <label>Account role<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}><option value="user">Standard user</option><option value="super_admin">Super admin</option></select></label>}<button className="button primary" type="submit" disabled={submitting}>{submitting ? 'Sending OTP...' : register ? 'Send OTP & create account' : 'Send OTP & sign in'} <ArrowUpRight size={16} /></button></form> : <form onSubmit={verify}><label>One-time verification code<input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={code} onChange={event => setCode(event.target.value)} required placeholder="6 digit code" /></label><div className="auth-actions"><button className="button primary" type="submit" disabled={submitting}>{submitting ? 'Verifying...' : register ? 'Verify OTP & create account' : 'Verify OTP & sign in'} <ShieldCheck size={16} /></button><button className="button secondary" type="button" onClick={resendOtp} disabled={resending}>{resending ? 'Resending...' : 'Resend OTP'}</button><button className="button secondary" type="button" onClick={() => { setChallenge(null); setCode(''); setError(''); setStatusMessage('') }}>{register ? 'Change email' : 'Back'}</button></div>{statusMessage && <div className="demo-code">{statusMessage}</div>}{challenge.emailDelivery?.status === 'sent' && <div className="demo-code">OTP sent to <strong>{challenge.emailDelivery.to}</strong>.<small>{challenge.emailDelivery.previewUrl ? <>Temp mail inbox preview: <a href={challenge.emailDelivery.previewUrl} target="_blank" rel="noreferrer">Open OTP email</a></> : 'Check your email inbox (and spam folder) for the 6-digit verification code.'}</small></div>}{challenge.emailDelivery?.status === 'failed' && <p className="form-error">Could not send OTP email to {challenge.emailDelivery.to}: {challenge.emailDelivery.error}</p>}{challenge.devCode && <div className="demo-code">Development delivery code: <strong>{challenge.devCode}</strong><small>{challenge.emailDelivery?.status === 'not_configured' ? `SMTP credentials are not configured in .env yet, so email delivery to ${challenge.destination} could not run. Add SMTP_USER and SMTP_PASSWORD (Google App Password) in .env to deliver real emails.` : 'Shown only in local development because email delivery did not succeed.'}</small></div>}</form>}{error && <p className="form-error">{error}</p>}<small>Passwords are hashed by the backend. Face recognition is not enabled as an authentication shortcut; production biometrics should use WebAuthn/passkeys rather than storing face images.</small></div></main><Footer /></>
}
function Dashboard({ initialTab = 'overview' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({ totalLogs: 0, verified: 0, tampered: 0, activeAlerts: 0 })
  const [logs, setLogs] = useState([])
  const [alerts, setAlerts] = useState([])
  const [activeTab, setActiveTab] = useState(initialTab)
  const [adminHashes, setAdminHashes] = useState([])
  const [adminError, setAdminError] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)
  const [openedFile, setOpenedFile] = useState(null)
  const [openingFile, setOpeningFile] = useState(false)
  const [editingFile, setEditingFile] = useState(false)
  const [savingFile, setSavingFile] = useState(false)
  const [modalError, setModalError] = useState('')
  const [modalNotice, setModalNotice] = useState('')
  const token = localStorage.getItem('securelog_token')
  const api = apiBase
  const isSuperAdmin = user?.role === 'super_admin'
  const loadAdminHashes = async () => {
    if (!token) return
    setAdminLoading(true)
    setAdminError('')
    try {
      const response = await fetch(`${api}/api/admin/hashes`, { headers: { Authorization: `Bearer ${token}` } })
      const body = await readJsonResponse(response)
      if (!response.ok) throw new Error(body.error || 'Super admin access is required.')
      setAdminHashes(body.hashes || [])
    } catch (adminLoadError) {
      setAdminError(adminLoadError.message)
      setAdminHashes([])
    } finally {
      setAdminLoading(false)
    }
  }
  const refreshStatsAndAlerts = async () => {
    if (!token) return
    const headers = { Authorization: `Bearer ${token}` }
    const [statsResponse, alertsResponse] = await Promise.all([
      fetch(`${api}/api/dashboard/stats`, { headers }),
      fetch(`${api}/api/alerts`, { headers }),
    ])
    if (statsResponse.ok) setStats(await statsResponse.json())
    if (alertsResponse.ok) setAlerts((await alertsResponse.json()).alerts)
    if (isSuperAdmin && activeTab === 'hashes') await loadAdminHashes()
  }
  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])
  useEffect(() => {
    if (!token) return
    const headers = { Authorization: `Bearer ${token}` }
    const syncWorkspace = () => Promise.all([
      fetch(`${api}/api/dashboard/stats`, { headers }),
      fetch(`${api}/api/logs`, { headers }),
      fetch(`${api}/api/alerts`, { headers }),
    ]).then(async ([statsResponse, logsResponse, alertsResponse]) => {
      if (statsResponse.ok) setStats(await statsResponse.json())
      if (logsResponse.ok) setLogs((await logsResponse.json()).logs)
      if (alertsResponse.ok) setAlerts((await alertsResponse.json()).alerts)
    }).catch(() => {})
    fetch(`${api}/api/auth/me`, { headers }).then(async meResponse => {
      if (meResponse.status === 401) return
      const meData = await meResponse.json()
      setUser(meData.user)
      await syncWorkspace()
    })
    const timer = setInterval(syncWorkspace, 5000)
    return () => clearInterval(timer)
  }, [api, token])
  useEffect(() => {
    if (activeTab === 'hashes' && isSuperAdmin) loadAdminHashes()
  }, [activeTab, isSuperAdmin])
  const signOut = () => {
    localStorage.removeItem('securelog_token')
    navigate('/login')
  }
  const uploadFile = async () => {
    if (!file) return
    setUploading(true)
    setError('')
    setResult(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const response = await fetch(`${api}/api/logs/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
      const body = await readJsonResponse(response)
      if (!response.ok) throw new Error(body.error || 'Upload failed')
      setResult({ type: 'upload', logId: body.logId, storage: body.storage })
      setLogs(current => [body, ...current])
      await refreshStatsAndAlerts()
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setUploading(false)
    }
  }
  const formatEmailSummary = emailNote => {
    if (!emailNote) return ''
    if (emailNote.status === 'sent') return `Alert emailed to ${emailNote.to}`
    if (emailNote.status === 'not_configured') return `Alert queued for ${emailNote.to} (configure SMTP in .env to deliver)`
    if (emailNote.status === 'failed') return `Email alert failed for ${emailNote.to}: ${emailNote.error}`
    return ''
  }
  const deleteFile = async logId => {
    setError('')
    try {
      const response = await fetch(`${api}/api/logs/${logId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const body = response.status === 204 ? null : await readJsonResponse(response)
      if (!response.ok) throw new Error(body?.error || 'Could not delete file')
      if (body?.emailNotification) {
        setResult({
          type: 'delete',
          logId,
          storage: 'FILE DELETED · ALERT RECORDED',
          emailSummary: formatEmailSummary(body.emailNotification),
        })
      }
      setLogs(current => current.filter(log => log.logId !== logId))
      await refreshStatsAndAlerts()
    } catch (deleteError) {
      setError(requestErrorMessage(deleteError))
    }
  }
  const openFileModal = async log => {
    setError('')
    setModalError('')
    setModalNotice('')
    setOpeningFile(true)
    setEditingFile(false)
    try {
      const response = await fetch(`${api}/api/logs/${log.logId}/content`, { headers: { Authorization: `Bearer ${token}` } })
      const body = await readJsonResponse(response)
      if (!response.ok) throw new Error(body.error || 'Could not open file.')
      setOpenedFile({ ...body, originalContent: body.content })
    } catch (openError) {
      setError(requestErrorMessage(openError))
    } finally {
      setOpeningFile(false)
    }
  }
  const saveModifiedFile = async () => {
    if (!openedFile) return
    setModalError('')
    setModalNotice('')
    setSavingFile(true)
    try {
      const response = await fetch(`${api}/api/logs/${openedFile.logId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: openedFile.content }),
      })
      const body = await readJsonResponse(response)
      if (!response.ok) throw new Error(body.error || 'Could not save file changes.')
      const emailSummary = formatEmailSummary(body.emailNotification)
      setResult({ type: 'verify', logId: body.logId, storage: body.result, emailSummary })
      setLogs(current => current.map(item => item.logId === openedFile.logId ? { ...item, status: body.result } : item))
      setOpenedFile(current => current ? { ...current, status: body.result, originalContent: current.content } : null)
      setEditingFile(false)
      setModalNotice(body.result === 'TAMPERED'
        ? `Modification detected (${body.result}). ${emailSummary || 'Security alert recorded.'}`
        : 'File matches original registered fingerprint (VERIFIED).')
      await refreshStatsAndAlerts()
    } catch (saveError) {
      setModalError(requestErrorMessage(saveError))
    } finally {
      setSavingFile(false)
    }
  }
  const verifyFile = async (logId, candidateFile = null) => {
    setError('')
    try {
      let bodyData
      const headers = { Authorization: `Bearer ${token}` }
      if (candidateFile) {
        bodyData = new FormData()
        bodyData.append('file', candidateFile)
      }
      const response = await fetch(`${api}/api/logs/${logId}/verify`, { method: 'POST', headers, ...(bodyData ? { body: bodyData } : {}) })
      const body = await readJsonResponse(response)
      if (!response.ok) throw new Error(body.error || 'Verification failed')
      setResult({ type: 'verify', logId: body.logId, storage: body.result, emailSummary: formatEmailSummary(body.emailNotification) })
      setLogs(current => current.map(log => log.logId === logId ? { ...log, status: body.result } : log))
      await refreshStatsAndAlerts()
    } catch (verifyError) {
      setError(verifyError.message)
    }
  }
  return <><Header /><main className="dashboard section-pad"><div className="dash-heading"><div><div className="eyebrow">Workspace / {isSuperAdmin ? 'Super Admin' : 'Overview'}</div><h1>{user ? `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${user.name.split(' ')[0]}.` : 'Your secure workspace.'}</h1><p>Your private integrity surface, at a glance.</p></div><div className="dash-actions"><Link className="button primary" to="/verify">Verify a log <Search size={16} /></Link>{user && <button className="button secondary" type="button" onClick={signOut}>Sign out</button>}</div></div><div className="dash-tabs" role="tablist" aria-label="Workspace sections"><button type="button" role="tab" aria-selected={activeTab === 'overview'} className={activeTab === 'overview' ? 'dash-tab active' : 'dash-tab'} onClick={() => { setActiveTab('overview'); if (location.pathname !== '/dashboard') navigate('/dashboard') }}>Overview</button>{isSuperAdmin && <button type="button" role="tab" aria-selected={activeTab === 'hashes'} className={activeTab === 'hashes' ? 'dash-tab active' : 'dash-tab'} onClick={() => { setActiveTab('hashes'); if (location.pathname !== '/admin/hashes') navigate('/admin/hashes') }}><KeyRound size={15} /> Super Admin · Hash Values</button>}</div>{activeTab === 'hashes' ? (isSuperAdmin ? <section className="admin-hash-panel"><div className="panel-heading"><div><div className="eyebrow">Super Admin Restricted</div><h2>Full SHA-256 Hash Registry</h2><p>Complete hash values across encrypted log records. Accessible only to Super Admins.</p></div><button className="button secondary" type="button" onClick={loadAdminHashes} disabled={adminLoading}>{adminLoading ? 'Refreshing...' : 'Refresh hashes'}</button></div>{adminError && <p className="upload-error">{adminError}</p>}{adminHashes.length ? <div className="hash-table-wrap"><table className="hash-table"><thead><tr><th>Record</th><th>Owner</th><th>Status</th><th>Entire SHA-256 Hash</th></tr></thead><tbody>{adminHashes.map(item => <tr key={item.logId}><td><strong>{item.originalFileName}</strong><small>{item.logId}</small></td><td><span>{item.ownerName}</span><small>{item.ownerEmail}</small></td><td><b className={`status-${item.status.toLowerCase()}`}>{item.status}</b></td><td><code className="full-hash">{item.sha256}</code></td></tr>)}</tbody></table></div> : <div className="empty-alert"><Database size={24} /><span>No registered hashes</span><small>Uploaded records will appear here for Super Admins.</small></div>}</section> : <section className="admin-restricted"><LockKeyhole size={26} /><h2>Super Admin access only</h2><p>Full SHA-256 hash values are restricted to Super Admin accounts.</p><button className="button primary" type="button" onClick={() => { setActiveTab('overview'); navigate('/dashboard') }}>Return to Overview</button></section>) : <><section className="upload-panel"><div><div className="eyebrow">Private encrypted storage</div><h2>Upload a record and calculate its fingerprint.</h2><p>Accepted formats: .log, .txt, .json, .csv. Files are encrypted with AES-256-GCM inside your private server storage.</p></div><div className="upload-controls"><label className="file-picker"><Upload size={17} /><span>{file ? file.name : 'Choose a log file'}</span><input type="file" accept=".log,.txt,.json,.csv" onChange={event => setFile(event.target.files?.[0] || null)} /></label><button className="button primary" disabled={!file || uploading || !token} onClick={uploadFile}>{uploading ? 'Encrypting...' : 'Insert and hash'} <Fingerprint size={16} /></button></div>{!token && <p className="upload-error">Sign in and complete the second verification step to upload files.</p>}{error && <p className="upload-error">{error}</p>}{result && <div className="hash-result">{result.type === 'upload' && <div><span>REGISTERED LOG ID</span><strong>{result.logId}</strong></div>}<div><span>RESULT</span><strong>{result.storage}</strong></div>{result.emailSummary && <div><span>EMAIL ALERT</span><strong>{result.emailSummary}</strong></div>}</div>}</section><div className="metric-grid">{[['Total logs',stats.totalLogs,'Your records'],['Verified',stats.verified,'Integrity confirmed'],['Tampered',stats.tampered,'Mismatch events'],['Active alerts',stats.activeAlerts,'Needs attention']].map(([label, value, note]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}</div><div className="dashboard-grid"><div className="empty-panel"><div className="panel-heading"><h2>Your encrypted records</h2><Fingerprint size={18} /></div>{logs.length ? <div className="record-list">{logs.map(log => <div className="record-row" key={log.logId}><span>{log.originalFileName}{log.status !== 'VERIFIED' && <small>{log.logId}</small>}</span><b className={`status-${log.status.toLowerCase()}`}>{log.status}</b><div className="record-actions"><button type="button" onClick={() => verifyFile(log.logId)}>Verify</button><button type="button" onClick={() => openFileModal(log)} disabled={openingFile}>Check file</button><button type="button" onClick={() => deleteFile(log.logId)}>Delete</button></div></div>)}</div> : <div className="empty-alert"><Database size={24} /><span>No uploaded records</span><small>Your private records will appear here.</small></div>}</div><div className="alert-panel"><div className="panel-heading"><h2>Security alerts</h2><Bell size={18} /></div>{alerts.length ? <div className="alert-list">{alerts.map(alert => <div className="alert-row" key={alert.logId}><strong>{alert.severity}</strong><span>{alert.message}<small>{new Date(alert.createdAt).toLocaleString()}</small>{alert.emailNotification && <small className="alert-email">{alert.emailNotification.status === 'sent' ? `Email alert sent to ${alert.emailNotification.to}` : alert.emailNotification.status === 'not_configured' ? `Email alert target: ${alert.emailNotification.to} (set SMTP_* in .env to send)` : alert.emailNotification.status === 'failed' ? `Email delivery failed for ${alert.emailNotification.to}: ${alert.emailNotification.error}` : ''}</small>}</span></div>)}</div> : <div className="empty-alert"><ShieldCheck size={24} /><span>No active alerts</span><small>Integrity events will surface here.</small></div>}</div></div>{openedFile && <div className="file-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Inspect ${openedFile.originalFileName}`}><div className="file-modal"><div className="panel-heading"><div><div className="eyebrow">Opened record · <b className={`status-${openedFile.status.toLowerCase()}`}>{openedFile.status}</b></div><h2>{openedFile.originalFileName}</h2><small>{openedFile.logId}</small></div><button className="button secondary" type="button" onClick={() => { setOpenedFile(null); setEditingFile(false); setModalError(''); setModalNotice('') }}><X size={16} /> Close</button></div><textarea className="file-editor" value={openedFile.content} readOnly={!editingFile} onChange={event => setOpenedFile({ ...openedFile, content: event.target.value })} rows={14} spellCheck={false} />{modalError && <p className="upload-error">{modalError}</p>}{modalNotice && <div className="demo-code">{modalNotice}</div>}<div className="file-modal-actions">{!editingFile ? <button className="button primary" type="button" onClick={() => { setEditingFile(true); setModalError(''); setModalNotice('') }}>Modify file</button> : <><button className="button primary" type="button" disabled={savingFile} onClick={saveModifiedFile}>{savingFile ? 'Saving & checking...' : 'Save modifications'}</button><button className="button secondary" type="button" disabled={savingFile} onClick={() => { setOpenedFile(current => current ? { ...current, content: current.originalContent } : null); setEditingFile(false); setModalError('') }}>Cancel edit</button></>}</div></div></div>}</>}</main></> }

export default function App() { return <Routes><Route path="/" element={<DetailedHome />} /><Route path="/verify" element={<Verify />} /><Route path="/login" element={<Login />} /><Route path="/register" element={<Login register />} /><Route path="/dashboard" element={<Dashboard />} /><Route path="/admin/hashes" element={<Dashboard initialTab="hashes" />} /><Route path="/features" element={<GenericPage eyebrow="The platform" title="Security that leaves a trail." text="SecureLog brings practical cryptography and verifiable records into one understandable system." />} /><Route path="/how-it-works" element={<GenericPage eyebrow="How it works" title="From log to proof." text="A clear chain from application event to encrypted storage, blockchain registration, and human-readable verification." />} /><Route path="/use-cases" element={<GenericPage eyebrow="Use cases" title="Evidence for every environment." text="Education, finance, healthcare, government, cloud, enterprise, software, and research teams can start with the same integrity primitives." />} /><Route path="/security" element={<GenericPage eyebrow="Security" title="Confidentiality. Integrity. Accountability." text="AES-256-GCM protects stored payloads. SHA-256 fingerprints are anchored on-chain. JWT, RBAC, and audit logs govern access and investigation." />} /><Route path="/api" element={<GenericPage eyebrow="Developer API" title="Send logs. Get evidence back." text="A focused ingestion API for existing applications, with API-key authentication and a response that carries the real log ID, hash, and blockchain transaction." />} /><Route path="*" element={<DetailedHome />} /></Routes> }
