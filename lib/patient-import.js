/**
 * Patient data migration — CSV parsing, column mapping, and normalization.
 * Shared between the import API and the client-side migration wizard.
 */

export const DENTOS_FIELDS = [
  { key: 'name', label: 'Patient Name', required: true },
  { key: 'phone', label: 'Phone Number', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'dob', label: 'Date of Birth', required: false },
  { key: 'gender', label: 'Gender', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'allergies', label: 'Allergies', required: false },
  { key: 'blood_group', label: 'Blood Group', required: false },
  { key: 'medical_history', label: 'Medical History', required: false },
  { key: 'referral_source', label: 'Referral Source', required: false },
]

export const IMPORT_SOURCES = [
  {
    id: 'practo',
    label: 'Practo (recommended)',
    description: 'Practo Ray / Practo Pro patient exports',
  },
  {
    id: 'auto',
    label: 'Auto-detect',
    description: 'Match columns automatically from any export',
  },
  {
    id: 'generic',
    label: 'Other software',
    description: 'DentalSoft, mDent, Excel, Google Sheets, etc.',
  },
  {
    id: 'dentos',
    label: 'DentOS template',
    description: 'Our standard CSV template',
  },
]

/** Normalized alias tokens → DentOS field key */
export const FIELD_ALIASES = {
  name: [
    'name', 'patient_name', 'patientname', 'full_name', 'fullname', 'patient',
    'client_name', 'clientname', 'customer_name', 'member_name', 'pt_name',
    'ptname', 'first_name', 'firstname', 'last_name', 'lastname', 'display_name',
    'patient_full_name', 'registered_name',
  ],
  phone: [
    'phone', 'phone_no', 'phoneno', 'phone_number', 'phonenumber', 'mobile',
    'mobile_no', 'mobileno', 'mobile_number', 'mobilenumber', 'contact',
    'contact_no', 'contactno', 'contact_number', 'contactnumber', 'cell',
    'cellphone', 'cell_phone', 'telephone', 'tel', 'whatsapp', 'whatsapp_no',
    'primary_phone', 'patient_phone', 'patient_mobile', 'primary_mobile',
    'contact_mobile', 'registered_mobile',
  ],
  email: [
    'email', 'email_id', 'emailid', 'email_address', 'emailaddress', 'e_mail',
    'mail', 'patient_email',
  ],
  dob: [
    'dob', 'date_of_birth', 'dateofbirth', 'birth_date', 'birthdate', 'birthday',
    'birth_day', 'd_o_b', 'patient_dob', 'age_dob',
  ],
  gender: ['gender', 'sex', 'patient_gender'],
  address: [
    'address', 'patient_address', 'home_address', 'residential_address',
    'location', 'city', 'full_address', 'addr', 'locality', 'street',
    'street_address', 'area', 'pincode', 'pin_code', 'state',
  ],
  allergies: ['allergies', 'allergy', 'known_allergies', 'drug_allergies'],
  blood_group: [
    'blood_group', 'bloodgroup', 'blood_type', 'bloodtype', 'blood', 'b_group',
  ],
  medical_history: [
    'medical_history', 'medicalhistory', 'med_history', 'medhistory',
    'past_history', 'clinical_history', 'history', 'conditions',
  ],
  referral_source: [
    'referral_source', 'referralsource', 'referral', 'source', 'referred_by',
    'how_did_you_hear', 'lead_source',
  ],
}

/** Exact header → field for known export formats (keys are normalized) */
export const SOURCE_HEADER_PRESETS = {
  practo: {
    // Name
    patient_name: 'name',
    name: 'name',
    full_name: 'name',
    patient: 'name',
    patient_full_name: 'name',
    registered_name: 'name',
    // Phone — Practo typically exports "Mobile Number" or "Mobile"
    mobile: 'phone',
    mobile_number: 'phone',
    mobile_no: 'phone',
    phone: 'phone',
    phone_number: 'phone',
    contact_number: 'phone',
    contact_no: 'phone',
    primary_mobile: 'phone',
    registered_mobile: 'phone',
    patient_mobile: 'phone',
    // Email
    email: 'email',
    email_id: 'email',
    email_address: 'email',
    patient_email: 'email',
    // Demographics
    gender: 'gender',
    sex: 'gender',
    date_of_birth: 'dob',
    dob: 'dob',
    birth_date: 'dob',
    birthdate: 'dob',
    // Address — primary column; city/state/pin merged in enhancePractoRow
    address: 'address',
    full_address: 'address',
    patient_address: 'address',
    home_address: 'address',
    locality: 'address',
    street_address: 'address',
    // Clinical
    blood_group: 'blood_group',
    bloodgroup: 'blood_group',
    allergies: 'allergies',
    allergy: 'allergies',
    medical_history: 'medical_history',
    history: 'medical_history',
    // Referral
    source: 'referral_source',
    referral_source: 'referral_source',
    referred_by: 'referral_source',
    patient_source: 'referral_source',
  },
  dentos: {
    name: 'name',
    phone: 'phone',
    email: 'email',
    date_of_birth: 'dob',
    gender: 'gender',
    address: 'address',
    allergies: 'allergies',
    blood_group: 'blood_group',
    medical_history: 'medical_history',
    referral_source: 'referral_source',
  },
}

export function normalizeHeader(header) {
  return String(header || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

/** Parse CSV text into { headers, rows } with basic RFC 4180 support */
export function parseCSV(text) {
  if (!text || typeof text !== 'string') return null

  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        inQuotes = false
      } else {
        field += c
      }
      continue
    }

    if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field.trim())
      field = ''
    } else if (c === '\n' || (c === '\r' && next === '\n')) {
      row.push(field.trim())
      field = ''
      if (row.some(cell => cell !== '') || rows.length === 0) rows.push(row)
      row = []
      if (c === '\r') i++
    } else if (c !== '\r') {
      field += c
    }
  }

  if (field.length || row.length) {
    row.push(field.trim())
    if (row.some(cell => cell !== '')) rows.push(row)
  }

  const nonEmpty = rows.filter(r => r.some(c => c !== ''))
  if (nonEmpty.length < 2) return null

  const headers = nonEmpty[0].map(h => h.replace(/^\uFEFF/, '').trim())
  const data = nonEmpty.slice(1).map(cells => {
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? ''
    })
    return obj
  })

  return { headers, data }
}

function aliasScore(normalizedHeader, aliases) {
  if (aliases.includes(normalizedHeader)) return 100
  for (const alias of aliases) {
    if (normalizedHeader.includes(alias) || alias.includes(normalizedHeader)) return 80
  }
  return 0
}

/** Heuristic: does this look like a Practo Ray export? */
export function detectPractoExport(headers) {
  const norms = headers.map(normalizeHeader)
  const practoSignals = [
    'patient_name', 'mobile_number', 'mobile_no', 'registered_mobile',
    'patient_id', 'uhid', 'practo', 'registration_date', 'patient_source',
  ]
  return norms.filter(n => practoSignals.some(s => n.includes(s) || s.includes(n))).length >= 2
}

const PRACTO_ADDRESS_KEYS = [
  'Address', 'Full Address', 'Patient Address', 'Home Address', 'Locality',
  'Street', 'Street Address', 'Area', 'City', 'State', 'Pincode', 'Pin Code', 'Pin',
]

const PRACTO_PHONE_PRIORITY = [
  'Mobile Number', 'Mobile', 'Mobile No', 'Primary Mobile', 'Registered Mobile',
  'Contact Number', 'Phone', 'Phone Number', 'Patient Mobile', 'Alternate Mobile', 'Landline',
]

/** Merge Practo-specific split columns (name, phone, address) after base mapping */
export function enhancePractoRow(raw, patient) {
  const out = { ...patient }

  if (!out.name) {
    const first = raw['First Name'] || raw['First name'] || raw['first_name'] || ''
    const last = raw['Last Name'] || raw['Last name'] || raw['last_name'] || ''
    const combined = [first, last].map(s => String(s).trim()).filter(Boolean).join(' ')
    if (combined) out.name = combined
  }

  if (!out.phone) {
    for (const key of PRACTO_PHONE_PRIORITY) {
      const val = raw[key]
      if (val != null && String(val).trim()) {
        out.phone = normalizePhone(val)
        if (/^\d{10}$/.test(out.phone)) break
      }
    }
  }

  const addrParts = []
  if (!out.address) {
    for (const key of PRACTO_ADDRESS_KEYS) {
      const val = raw[key]
      if (val != null && String(val).trim()) addrParts.push(String(val).trim())
    }
    if (addrParts.length) out.address = [...new Set(addrParts)].join(', ')
  } else {
    const extras = ['City', 'State', 'Pincode', 'Pin Code', 'Pin', 'Locality', 'Area']
    for (const key of extras) {
      const val = raw[key]
      if (val != null && String(val).trim() && !out.address.includes(String(val).trim())) {
        out.address = `${out.address}, ${String(val).trim()}`
      }
    }
  }

  if (!out.dob && raw['Age']) {
    const age = parseInt(String(raw['Age']).replace(/\D/g, ''), 10)
    if (age > 0 && age < 120) {
      const y = new Date().getFullYear() - age
      out.dob = `${y}-01-01`
    }
  }

  if (!out.referral_source) {
    const src = raw['Source'] || raw['Patient Source'] || raw['Referral Source'] || raw['Referred By']
    if (src) out.referral_source = String(src).trim()
  }

  return out
}

/** Build column → DentOS field mapping from headers and optional source preset */
export function suggestMapping(headers, sourceId = 'practo') {
  const mapping = {}
  const usedFields = new Set()

  const effectiveSource =
    sourceId === 'auto' && detectPractoExport(headers) ? 'practo' : sourceId

  const preset =
    effectiveSource !== 'auto' && effectiveSource !== 'generic'
      ? SOURCE_HEADER_PRESETS[effectiveSource] || {}
      : {}

  for (const header of headers) {
    const norm = normalizeHeader(header)
    if (!norm) continue

    let field = preset[norm] || null

    if (!field) {
      let bestScore = 0
      for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
        const score = aliasScore(norm, aliases)
        if (score > bestScore && !usedFields.has(key)) {
          bestScore = score
          field = key
        }
      }
      if (bestScore < 60) field = null
    }

    if (field && !usedFields.has(field)) {
      mapping[header] = field
      usedFields.add(field)
    } else {
      mapping[header] = null
    }
  }

  return mapping
}

export function normalizePhone(raw) {
  if (raw == null || raw === '') return ''
  let digits = String(raw).replace(/\D/g, '')

  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)

  return digits
}

export function normalizeGender(raw) {
  if (!raw) return ''
  const v = String(raw).toLowerCase().trim()
  if (['m', 'male', 'man', 'boy'].includes(v)) return 'male'
  if (['f', 'female', 'woman', 'girl'].includes(v)) return 'female'
  if (['o', 'other', 'others', 'non-binary', 'nonbinary'].includes(v)) return 'other'
  return v
}

/** Parse common date formats → ISO YYYY-MM-DD or empty string */
export function normalizeDate(raw) {
  if (!raw) return ''
  const s = String(raw).trim()
  if (!s) return ''

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (dmy) {
    let [, d, m, y] = dmy
    if (y.length === 2) y = parseInt(y) > 30 ? `19${y}` : `20${y}`
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // MM/DD/YYYY (US) — only if day part > 12
  const mdy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (mdy) {
    const [, a, b, y] = mdy
    if (parseInt(a) > 12) {
      return `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
    }
  }

  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return ''
}

export function ageFromDob(dob) {
  if (!dob) return null
  const dobDate = new Date(dob)
  if (isNaN(dobDate.getTime())) return null
  const today = new Date()
  return (
    today.getFullYear() -
    dobDate.getFullYear() -
    (today < new Date(today.getFullYear(), dobDate.getMonth(), dobDate.getDate()) ? 1 : 0)
  )
}

/** Transform raw CSV rows using column mapping → normalized patient objects */
export function transformRows(rawRows, mapping, sourceId = 'practo') {
  const patients = []
  const rowIssues = []
  const usePractoEnhance =
    sourceId === 'practo' ||
    (sourceId === 'auto' && rawRows.length > 0 && detectPractoExport(Object.keys(rawRows[0])))

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const rowNum = i + 2
    let patient = {
      name: '',
      phone: '',
      email: '',
      dob: '',
      gender: '',
      address: '',
      allergies: '',
      blood_group: '',
      medical_history: '',
      referral_source: '',
    }

    for (const [header, field] of Object.entries(mapping)) {
      if (!field || !(field in patient)) continue
      const val = raw[header]
      if (val != null && String(val).trim() !== '') {
        patient[field] = String(val).trim()
      }
    }

    if (usePractoEnhance) {
      patient = enhancePractoRow(raw, patient)
    }

    patient.phone = normalizePhone(patient.phone)
    patient.gender = normalizeGender(patient.gender)
    patient.dob = normalizeDate(patient.dob)
    patient.name = patient.name.trim()

    const issues = validatePatient(patient, rowNum)
    patients.push({ ...patient, _row: rowNum, _issues: issues })
    if (issues.length) rowIssues.push({ row: rowNum, issues })
  }

  return { patients, rowIssues }
}

export function validatePatient(patient, rowNum) {
  const issues = []
  if (!patient.name) issues.push('Missing patient name')
  if (!patient.phone) issues.push('Missing phone number')
  else if (!/^\d{10}$/.test(patient.phone)) {
    issues.push(`Invalid phone (${patient.phone.length} digits — need 10)`)
  }
  if (patient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email)) {
    issues.push('Invalid email format')
  }
  return issues
}

export function mappingSummary(mapping) {
  const mapped = Object.entries(mapping).filter(([, f]) => f)
  const required = DENTOS_FIELDS.filter(f => f.required).map(f => f.key)
  const mappedFields = new Set(mapped.map(([, f]) => f))
  const missingRequired = required.filter(k => !mappedFields.has(k))
  return { mappedCount: mapped.length, missingRequired, isReady: missingRequired.length === 0 }
}

export function getSampleCSV() {
  return `name,phone,email,date_of_birth,gender,address,allergies,blood_group
"John Doe","9876543210","john@example.com","1990-05-15","male","123 Main St, City","Penicillin","A+"
"Jane Smith","9876543211","jane@example.com","1985-10-20","female","456 Oak Ave, Town","","O+"`
}

export function toImportPayload(patients) {
  return patients
    .filter(p => !p._issues?.length)
    .map(({ _row, _issues, ...rest }) => rest)
}
