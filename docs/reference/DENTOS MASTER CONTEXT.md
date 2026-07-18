# **DENTOS MASTER PRODUCT CONTEXT**

## **What is DentOS?**

DentOS is a cloud-based Dental Practice Management System (PMS) / Clinic Operating System being developed for Indian dental clinics.

The goal is not just appointment management.

DentOS aims to become the complete operating system for running a dental clinic, including:

* Patient Management  
* Appointments  
* Clinical Records  
* Treatment Planning  
* Billing  
* Lab Cases  
* Reporting  
* Staff Management  
* File Management  
* Future AI-assisted workflows

DentOS is being built as a SaaS product that can eventually serve hundreds or thousands of clinics from a single platform.

This is NOT custom software for one clinic.

---

# **Current Team**

Founders:

* Prasanna Kapale  
* Ahemad Sayyed

Parent Company:

* Connec8

Connec8 builds software systems, business automation solutions, and AI-powered systems.

DentOS is the primary SaaS product currently under development.

---

# **Current Stage**

Current status:

* Working prototype exists  
* Multiple dentists have seen demos  
* Several senior dentists and multi-clinic operators have provided feedback  
* Some doctors have expressed interest in becoming collaborators or founding partners  
* Product is not yet production-ready  
* Backend architecture is being reconsidered before scaling

Current focus:

Build DentOS V2 with a strong foundation rather than continuously adding features to the prototype.

---

# **Current User Roles**

## **Admin**

Can:

* Manage clinic settings  
* Manage users  
* Access all modules  
* View reports

---

## **Doctor**

Can:

* View patients  
* Create visits  
* Add notes  
* Upload files  
* Create prescriptions  
* Track treatments

---

## **Receptionist**

Can:

* Register patients  
* Create appointments  
* Manage schedules  
* Handle billing workflows

Limited access compared to doctor/admin.

---

# **Current Core Workflow**

## **Step 1 \- Patient Registration**

Receptionist creates a patient.

Typical fields:

* Name  
* Phone Number  
* Age  
* Gender  
* Address  
* Basic Information

Patient profile is created.

---

## **Step 2 \- Appointment Creation**

Appointment is scheduled.

Fields:

* Doctor  
* Date  
* Time  
* Notes

Appointment appears in clinic schedule.

---

## **Step 3 \- Patient Visit**

Doctor opens patient profile.

Doctor can view:

* Past visits  
* Treatment history  
* Notes  
* Attachments  
* Billing history

---

## **Step 4 \- Clinical Entry**

Doctor records:

* Chief Complaint  
* Diagnosis  
* Findings  
* Treatment Notes  
* Prescription

These records become part of patient history.

---

## **Step 5 \- File Uploads**

Files can be attached to visits.

Current expected file types:

* Clinical Photos  
* X-Rays  
* RVG Images  
* OPG Images  
* PDFs  
* Reports

Future possibility:

* DICOM Support

Files remain linked to patient and visit history.

---

## **Step 6 \- Billing**

Treatments generate bills.

Workflow:

Treatment  
→ Invoice  
→ Payment  
→ Outstanding Tracking

---

## **Step 7 \- Follow-Up**

Patient history remains accessible.

Clinic can:

* Review previous visits  
* Review files  
* Review treatments  
* Review billing

---

# **Current Modules**

## **Dashboard**

Shows:

* Today’s Appointments  
* Revenue Metrics  
* Patient Statistics  
* Operational Summary

---

## **Patients**

Features:

* Create Patient  
* Edit Patient  
* View History  
* Visit Timeline

---

## **Appointments**

Features:

* Schedule  
* Reschedule  
* Manage Calendar

---

## **Billing**

Features:

* Invoice Generation  
* Payment Tracking  
* Outstanding Payments

---

## **Lab Cases**

Features:

* Lab Tracking  
* Case Status  
* Vendor Coordination

---

## **Vendors**

Features:

* Vendor Directory  
* Lab Relationships

---

## **Settings**

Features:

* Clinic Setup  
* User Management  
* Permissions

---

# **Feedback From Doctors**

Doctors repeatedly complained about existing software.

Major complaints:

## **Practo**

* Expensive  
* Storage restrictions  
* Additional charges  
* Data ownership concerns  
* Lack of customization

---

## **General Dental Software Problems**

* Outdated interfaces  
* Slow workflows  
* Difficult staff onboarding  
* Poor reporting  
* Vendor lock-in

---

# **DentOS Philosophy**

DentOS should be:

* Modern  
* Fast  
* Simple  
* Scalable  
* Secure  
* Customizable

The user experience should feel more like a modern SaaS platform than traditional clinic software.

---

# **Current Technical Situation**

Frontend currently exists.

Current stack:

* Next.js  
* React  
* Tailwind CSS  
* Shadcn UI

The frontend is largely expected to remain.

The backend foundation is being redesigned.

---

# **Proposed DentOS V2 Architecture**

Frontend:

* Next.js

Backend:

* NestJS

Database:

* PostgreSQL

ORM:

* Prisma

File Storage:

* AWS S3

Cache:

* Redis

Hosting:

* AWS

Monitoring:

* CloudWatch

Authentication:

* Role-Based Access Control

---

# **Multi-Tenant SaaS Requirement**

DentOS is a SaaS product.

One platform should support many clinics.

Each clinic must have isolated data.

Example:

Clinic A should never access Clinic B data.

Expected design:

Every major entity contains:

* clinic\_id

Including:

* Patients  
* Appointments  
* Visits  
* Bills  
* Users  
* Files  
* Reports

---

# **Security Requirements**

Must have:

* Secure authentication  
* Encrypted storage  
* Daily backups  
* Audit logs  
* Role permissions  
* Data export capability

---

# **Storage Philosophy**

Doctors dislike storage restrictions.

DentOS wants to avoid becoming another platform that constantly charges for additional storage.

However, the platform must remain profitable.

Current expectation:

Most clinics upload:

* Photos  
* RVGs  
* OPGs  
* PDFs  
* Reports

Not large radiology-scale datasets.

---

# **Data Ownership Principle**

A major differentiator:

The clinic owns its data.

Potential capabilities:

* Export Patients  
* Export Appointments  
* Export Billing  
* Export Files  
* Full Backup Export

Goal:

Reduce fear of vendor lock-in.

---

# **Founding Partner Strategy**

Several experienced dentists have shown strong interest.

Current approach:

Instead of giving equity immediately:

Create a Founding Partner Program.

Benefits:

* Early Access  
* Product Influence  
* Priority Support  
* Discounted Pricing

These clinics help shape the product.

---

# **Current Product Goal**

Immediate Goal:

Build DentOS V2 foundation.

Near-Term Goal:

Acquire first 3 clinics actively using DentOS.

Mid-Term Goal:

20–30 clinics.

Long-Term Goal:

National SaaS platform serving hundreds or thousands of clinics.

---

# **Important Context**

DentOS is NOT currently trying to build:

* Hospital ERP  
* Multi-specialty hospital software  
* Enterprise healthcare platform  
* Large radiology system

DentOS is currently focused on:

Modern dental clinic operations for small, medium, and multi-branch dental clinics.

Every recommendation should be practical for a startup with a small founding team and limited resources, while still allowing future scalability.

