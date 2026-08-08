'use client'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { BookOpen, CheckCircle2 } from 'lucide-react'

const PRACTO_STEPS = [
  'Log in to Practo Ray on your computer.',
  'Go to Patients (or Patient List / Reports → Patients).',
  'Filter to active patients if you only want current records.',
  'Click Export, Download, or Export to CSV.',
  'Save the file — it must be a .csv file (not .xlsx).',
  'Return here, keep Practo selected, and upload that file.',
]

const OTHER_STEPS = [
  'Open your current clinic software.',
  'Find Export patients, Download report, or Export to CSV.',
  'If only Excel is available: open the file → Save As → CSV.',
  'Select Other software or Auto-detect as the source above.',
  'Upload the CSV — we will match columns like Contact Number, Mobile, Phone No, etc.',
  'On the next step, confirm column mapping before importing.',
]

const DENTOS_STEPS = [
  'Click Template on this screen to download the DentOS CSV format.',
  'Fill in at least Patient Name and Phone (10-digit mobile) for each row.',
  'Optional columns: email, date_of_birth, gender, address, allergies, blood_group.',
  'Save as .csv and upload with DentOS template selected.',
]

const IMPORT_FLOW = [
  'Upload your CSV and pick your source software.',
  'Map fields — confirm Patient Name and Phone are mapped (required).',
  'Review — fix any rows flagged with errors before importing.',
  'Done — check Imported vs Skipped; duplicates are skipped automatically.',
]

const TROUBLESHOOTING = [
  { q: 'Invalid phone number', a: 'Phone must be a 10-digit Indian mobile. +91 and spaces are cleaned automatically. Map the mobile column, not landline.' },
  { q: 'Many rows skipped', a: 'Patients with the same name + phone already exist in your clinic — they are not duplicated.' },
  { q: 'File won\'t upload', a: 'Use .csv not .xlsx. The file needs a header row and at least one data row.' },
  { q: 'Column not detected', a: 'On the Map fields step, use the dropdown to map it manually to the correct DentOS field.' },
  { q: 'Only have Excel?', a: 'Open in Excel or Google Sheets → File → Download / Save As → CSV (.csv).' },
]

export default function PatientMigrationGuide({ sourceId = 'practo', defaultOpen = true }) {
  const defaultAccordion = sourceId === 'practo'
    ? 'practo'
    : sourceId === 'dentos'
      ? 'dentos'
      : 'other'

  return (
    <div className="rounded-lg border border-border bg-muted/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/60">
        <BookOpen className="w-4 h-4 text-[#0D9488] flex-shrink-0" />
        <p className="text-sm font-medium">How to migrate patient data</p>
      </div>

      <Accordion
        type="multiple"
        defaultValue={defaultOpen ? [defaultAccordion, 'flow', 'fields'] : []}
        className="px-4"
      >
        <AccordionItem value="practo" className="border-border">
          <AccordionTrigger className="text-sm py-3 hover:no-underline">
            <span>
              From Practo Ray
              {sourceId === 'practo' && (
                <span className="ml-2 text-[10px] font-normal text-[#0D9488] uppercase tracking-wide">Recommended</span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ol className="space-y-2 pb-2">
              {PRACTO_STEPS.map((step, i) => (
                <li key={i} className="flex gap-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0D9488]/10 text-[#0D9488] text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground pb-1">
              Columns like Patient Name, Mobile Number, Date of Birth, Email, Gender, and Address are mapped automatically.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="other" className="border-border">
          <AccordionTrigger className="text-sm py-3 hover:no-underline">
            From other software (DentalSoft, mDent, Excel…)
          </AccordionTrigger>
          <AccordionContent>
            <ol className="space-y-2 pb-2">
              {OTHER_STEPS.map((step, i) => (
                <li key={i} className="flex gap-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-muted text-foreground text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="dentos" className="border-border">
          <AccordionTrigger className="text-sm py-3 hover:no-underline">
            Using the DentOS CSV template
          </AccordionTrigger>
          <AccordionContent>
            <ol className="space-y-2 pb-2">
              {DENTOS_STEPS.map((step, i) => (
                <li key={i} className="flex gap-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-muted text-foreground text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="flow" className="border-border">
          <AccordionTrigger className="text-sm py-3 hover:no-underline">
            What happens in this wizard
          </AccordionTrigger>
          <AccordionContent>
            <ol className="space-y-2 pb-2">
              {IMPORT_FLOW.map((step, i) => (
                <li key={i} className="flex gap-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-[#0D9488] flex-shrink-0 mt-0.5" />
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="fields" className="border-border">
          <AccordionTrigger className="text-sm py-3 hover:no-underline">
            What data can be imported
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 pb-2 text-xs sm:text-sm">
              <p><span className="font-medium text-foreground">Required:</span> Name, Phone</p>
              <p><span className="font-medium text-foreground">Optional:</span> Email, DOB, Gender</p>
              <p><span className="font-medium text-foreground">Optional:</span> Address, Allergies</p>
              <p><span className="font-medium text-foreground">Optional:</span> Blood group, Medical history, Referral</p>
            </div>
            <p className="text-xs text-muted-foreground pb-1">
              Appointments, visits, bills, and lab cases are not imported via CSV — add those in DentOS after patients are migrated.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="help" className="border-border border-b-0">
          <AccordionTrigger className="text-sm py-3 hover:no-underline">
            Common issues
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-2 pb-2">
              {TROUBLESHOOTING.map(({ q, a }) => (
                <div key={q}>
                  <dt className="text-xs sm:text-sm font-medium text-foreground">{q}</dt>
                  <dd className="text-xs text-muted-foreground mt-0.5">{a}</dd>
                </div>
              ))}
            </dl>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
