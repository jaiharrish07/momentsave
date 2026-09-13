

#### **FULL STACK INTERNSHIP CHALLENGE - PHOTO SHARING PLATFORM** 

# **Software Requirement Document** 

|**Document Type:**|Requirement Specification|**Project:**|Photo Sharing Platform|
|---|---|---|---|
|**Role:**|Full-Stack Internship|**Submission Email:**|talent@trizen-ai.com|
|**Deadline:**|September 20, 2026 — 11:59|PM IST||



## **1. PROJECT OVERVIEW** 

Build a full-stack photo-sharing application. 

The application should allow a photography/event team to collaboratively upload photographs for an event, allow an Admin/Lead to consolidate and select photographs, and publish a customer-facing gallery protected by a PIN. 

The customer should be able to access the published gallery using a shareable link and PIN, without creating an account. 

## **2. USER ROLES** 

### **2.1 Admin / Lead** 

The Admin can: 

- Register/Login 

- Create an event 

- Add team members 

- 

- View all photos uploaded by the team 

- 

- Select photos for sharing 

- 

- Create and publish a gallery 

- 

- Generate a shareable link 

- 

- Set a PIN for the gallery 

### **2.2 Team Member** 

A Team Member can: 

- Login 

- View assigned events 

- Upload photos 

- 

- View their uploaded photos 

- 

Team Members must not be able to publish galleries or manage other users' photos. 

Page 1 of 5 

TrizenAI Technologies Private Limited 

### **2.3 Customer** 

The Customer does not need an account. 

The Customer receives: 

- Gallery Link + PIN 

They can: 

- Open the link 

- Enter the PIN 

- 

- View the published photos 

- 

- Browse the gallery 

- 

## **3. EXPECTED WORKFLOW SEQUENCE** 

|**Step**|**Actor**|**Action / Event**|
|---|---|---|
|1|Admin|Creates Event and adds Team Members.|
|2|Team Member|Uploads event photos to the platform.|
|3|Admin|Reviews all uploaded photos and selects photos for gallery.|
|4|Admin|Publishes Gallery and generates access Link + PIN.|
|5|Customer|Accesses Link, enters PIN, and views published photos.|



## **4. PHOTO UPLOAD & STORAGE REQUIREMENTS** 

Photos should be stored using appropriate object/file storage, such as AWS S3, Azure Blob Storage, Google Cloud Storage, or an equivalent cloud service. Do not store image files directly in the database. 

The database should contain photo metadata such as: 

- Photo ID 

- Event ID 

- Uploaded By 

- Filename 

- Storage Location 

- File Size 

- Created At 

- 

Multiple photo uploads should be supported. 

## **5. GALLERY MANAGEMENT** 

The Admin should be able to select photos and publish them as a gallery. 

Page 2 of 5 

TrizenAI Technologies Private Limited 

#### **`Example Operational State:`** 

```
Event Name: Arjun & Priya Wedding
Total Uploaded Photos: 1,250 | Selected for Publishing: 600
```

#### **`Generated Gallery Credentials:`** 

```
Gallery URL: https://your-domain.com/gallery/abc123
Access PIN: 482917
```

Only users with the correct PIN should be able to access the gallery. 

## **6. IMPORTANT TECHNICAL & SECURITY REQUIREMENTS** 

The application should include: 

- Authentication & Role-based authorization 

- 

- Secure photo uploads & Object storage integration 

- 

- Database schema design & API implementation 

- 

- Input validation & Error handling 

- 

- Responsive UI & Basic security practices 

- 

- Cloud deployment 

- 

The application should appropriately handle scenarios such as: 

- A user attempting to access another event 

- 

- A Team Member attempting to publish a gallery 

- 

- A failed photo upload 

- 

- An incorrect gallery PIN 

- 

- Attempted access to unpublished photos 

- 

## **7. TECHNOLOGY STACK GUIDELINES** 

There is no mandatory technology stack. You may use any suitable combination of modern backend, frontend, database, and cloud services (e.g., React, Next.js, Node.js, Python, Java, PostgreSQL, MongoDB, AWS, GCP, Docker, etc.). 

Choose the technologies you are comfortable with and document your choices. 

## **8. DEPLOYMENT & SUBMISSION DELIVERABLES** 

The application must be deployed and accessible online. 

The submission must include: 

- Live application URL 

- 

- Source code repository 

- 

- Demo Admin credentials 

- 

- Demo Team Member credentials 

- 

- Demo Gallery URL & Gallery PIN 

- 

Page 3 of 5 

TrizenAI Technologies Private Limited 

Do not commit secrets or credentials to Git. 

## **9. DOCUMENTATION (README)** 

The repository must contain a `README.md` explaining: 

- Project overview & Technology stack 

- 

- System Architecture & Database design 

- 

- Local setup instructions & Environment variables 

- 

- Deployment steps & Known limitations 

- 

A simple architecture diagram is encouraged. 

## **10. TESTING REQUIREMENTS** 

Include basic tests for important functionality, especially: 

- Authentication and Authorization 

- 

- Photo access controls 

- 

- Gallery publishing workflows 

- 

- PIN-protected access verification 

- 

## **11. OPTIONAL / BONUS FEATURES** 

If time permits, you may implement optional features such as image thumbnails/resizing, pagination/infinite scrolling, photo search/filtering, bulk upload, photo downloading, gallery expiration, CDN usage, or automated CI/CD pipelines. 

Do not sacrifice core functionality for bonus features. 

## **12. DEVELOPMENT & EVALUATION** 

You may use any tools, libraries, frameworks, or development approaches that help you build the application. You should understand and be able to explain the code you submit. 

During the evaluation, you may be asked to explain your architecture or make a small change to your application. 

## **13. QUALITY CRITERIA & AREAS TO CONSIDER** 

The following areas are provided as hints to help you think through the quality and completeness of your implementation: 

- **Functionality:** Core features should work reliably from end to end. 

- 

- **Frontend & UX:** Build a clean, responsive, intuitive user experience. 

- 

- **Backend & API Design:** Consider clear API structure, validation, error handling, and maintainability. 

- 

- **Database & Architecture:** Think about appropriate data models, relationships, scalability, and overall system architecture. 

- **Security & Authorization:** Protect user data, photos, APIs, authentication flows, and role-based access. 

- 

Page 4 of 5 

TrizenAI Technologies Private Limited 

- **Cloud & Deployment:** Consider how the application is deployed, configured, monitored, and accessed in a real-world environment. 

- **Testing:** Cover important functionality and critical user flows. 

- 

- **Code Quality & Documentation:** Keep the code organized, maintainable, and properly documented. 

- 

## **14. FINAL DELIVERABLES SUMMARY** 

Please ensure the following are included in your submission: 

- Source Code 

- Live Application 

- README 

- Architecture / DB explanation 

- Demo Credentials 

- Tests 

- Deployment 

### **Submission Guidelines** 

Send your completed submission to: **talent@trizen-ai.com** 

**Submission Deadline:** September 20, 2026 — 11:59 PM IST 

Please ensure that all required deliverables are accessible and functional at the time of submission. 

**TrizenAI Technologies Private Limited Talent Acquisition Team** 

Page 5 of 5 

TrizenAI Technologies Private Limited 

