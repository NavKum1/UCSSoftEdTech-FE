/**
 * Fixtures for G15 (WIOA indicators, apprenticeships, short-term credentials) and G16 (CIRR-style cohort reports).
 * Captured from the API's end-to-end run (backend/tests/e2e/g15g16_e2e.mjs) and sanitized.
 */
import type { A11yRoute, ApiFixture } from "./types";

const wioaDefinitions = {
  "reviewedOn": "2026-10-16",
  "verifyFormat": "Verify against the current PIRL/ETA format before submitting. This export is a working summary built from records your school entered or imported; it is not an official ETA-9170 file and does not show compliance.",
  "wageGap": "This platform cannot access state unemployment-insurance (UI) wage records, WRIS/SWIS or federal and military employment records. Employment and earnings come only from quarterly wage data that your staff enter or import (from the state's match results or from supplemental wage information with source documents). Until a quarter's data is entered, that participant is shown as \"not yet available\".",
  "indicators": [
    {
      "key": "employmentQ2",
      "name": "Employment rate, 2nd quarter after exit",
      "definition": "The percentage of participants who are in unsubsidized employment during the second quarter after exit from the program. For Title I Youth, education or training in that quarter also counts.",
      "method": "Exiters in the reporting period found employed in the 2nd quarter after the exit quarter, divided by exiters in the reporting period. Participants with a PIRL 923 exclusion are left out of both counts.",
      "rules": [
        {
          "text": "Definition and method (numerator and denominator) as in TEGL 10-16, Change 3, section A.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        },
        {
          "text": "Employment may be found through a direct UI wage record match, Federal or military employment records, or supplemental wage information.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        },
        {
          "text": "After two quarters without wage data or supplemental information, wages are converted to $0 permanently and count as not employed.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        },
        {
          "text": "Title I Youth: education or training in the quarter counts as a success (TEGL 10-16, Change 3, section A-1).",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        },
        {
          "text": "The ETA cohort windows for each program-year report (which exit dates feed which report) were not checked; this report uses the exit dates you choose.",
          "verified": false,
          "sourceUrl": "https://www.dol.gov/agencies/eta/performance/reporting"
        }
      ],
      "unconfirmedCount": 1
    },
    {
      "key": "employmentQ4",
      "name": "Employment rate, 4th quarter after exit",
      "definition": "The percentage of participants who are in unsubsidized employment during the fourth quarter after exit from the program (for Title I Youth, education or training also counts).",
      "method": "Same method as the 2nd-quarter rate, for the 4th quarter after the exit quarter.",
      "rules": [
        {
          "text": "Definition and method as in TEGL 10-16, Change 3, section B.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        }
      ],
      "unconfirmedCount": 0
    },
    {
      "key": "medianEarningsQ2",
      "name": "Median earnings, 2nd quarter after exit",
      "definition": "The median earnings of participants who are in unsubsidized employment during the second quarter after exit.",
      "method": "Total quarterly earnings of every participant employed in the 2nd quarter after exit, ordered from lowest to highest; the middle value. Participants not employed, or whose earnings are not yet available, are left out.",
      "rules": [
        {
          "text": "Method and exclusions (PIRL 1602 code 0 or 9, PIRL 1603 code 5, PIRL 1704 all 9s) as in TEGL 10-16, Change 3, section C.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        },
        {
          "text": "Actual wages paid are reported, not wages promised.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        },
        {
          "text": "When only a wage rate is known, ETA's Wage Conversion Chart (TEGL Attachment III) converts it to quarterly earnings. This platform does not convert: enter quarterly earnings.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        },
        {
          "text": "With an even number of values, this report averages the two middle values. TEGL 10-16 does not say how to handle an even count.",
          "verified": false,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        }
      ],
      "unconfirmedCount": 1
    },
    {
      "key": "credentialAttainment",
      "name": "Credential attainment",
      "definition": "The percentage of participants enrolled in an education or training program (excluding on-the-job training and customized training) who attain a recognized postsecondary credential or a secondary school diploma or its equivalent during participation or within one year after exit.",
      "method": "Exiters in the reporting period who were in education or training (other than OJT or customized training only), or in secondary education without a diploma, counted once one year has passed since exit. A secondary diploma counts only if the participant was also employed or enrolled in a postsecondary credential program within one year after exit.",
      "rules": [
        {
          "text": "Definition, the OJT and customized-training exclusion and the secondary-diploma condition: 20 CFR 677.155(a)(1)(iv) and TEGL 10-16, Change 3, section D.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        },
        {
          "text": "Participants enter the denominator once they reach one year after exit.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        },
        {
          "text": "Credential types follow PIRL 1800 codes: 1 secondary diploma or equivalency, 2 AA/AS, 3 BA/BS, 4 occupational licensure, 5 occupational certificate (including Registered Apprenticeship), 6 occupational certification, 7 other recognized diploma, degree or certificate.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/Performance/pdfs/ETA_9170%20CLEAN%201.20.2026%20(Accessible%20PDF).pdf"
        },
        {
          "text": "Graduate degrees do not count except in the VR program; this report does not apply the VR exception.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        },
        {
          "text": "Whether a short-term certificate is \"recognized\" is your school's and state's decision; mark each credential accordingly.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        }
      ],
      "unconfirmedCount": 0
    },
    {
      "key": "measurableSkillGains",
      "name": "Measurable skill gains",
      "definition": "The percentage of participants who, during a program year, are in an education or training program that leads to a recognized postsecondary credential or employment and who achieve documented academic, technical, occupational or other progress toward it.",
      "method": "Participants in education or training at any point in the program year (enrolled date, PIRL 1811, on or before the year end and not completed before it starts), divided into those with at least one gain dated in the program year. Not exit-based: current participants count.",
      "rules": [
        {
          "text": "The five gain types: educational functioning level; secondary diploma or equivalent; transcript or report card; satisfactory progress report toward milestones (e.g. completing one year of a registered apprenticeship); passing an occupational exam or trade-related benchmarks. 20 CFR 677.155(a)(1)(v) and TEGL 10-16, Change 3, section E.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        },
        {
          "text": "Counted once per period of participation per program year; the most recent gain of each type is reported (PIRL 1806-1810).",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        },
        {
          "text": "Program year = 1 July to 30 June.",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        },
        {
          "text": "This report counts one period of participation per participant record; split a person's separate periods into separate records.",
          "verified": false,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        }
      ],
      "unconfirmedCount": 1
    },
    {
      "key": "retention",
      "name": "Retention with the same employer (informational)",
      "definition": "Of participants employed in the 2nd quarter after exit, the share employed by the same employer in the 2nd and 4th quarters. A shared, statewide indicator: shown only as information.",
      "method": "Uses the employer identifier on your wage rows (PIRL 1618).",
      "rules": [
        {
          "text": "Effectiveness in Serving Employers is defined as Retention with the Same Employer in the final rule (TEGL 10-16, Change 3).",
          "verified": true,
          "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
        }
      ],
      "unconfirmedCount": 0
    }
  ],
  "exclusions": [
    {
      "text": "PIRL 923 codes: 01 institutionalized, 02 health/medical, 03 deceased, 04 reserve forces called to active duty, 05 foster care (Youth), 06 ineligible (VR only), 07 criminal offender in a correctional institution (section 225, Title II), 00 none.",
      "verified": true,
      "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/Performance/pdfs/ETA_9170%20CLEAN%201.20.2026%20(Accessible%20PDF).pdf"
    },
    {
      "text": "Codes 01-06 are left out of the exit-based indicators. Code 07 participants who stay incarcerated are left out of employment, earnings and credential attainment but stay in measurable skill gains (Attachment II, Table C).",
      "verified": true,
      "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
    },
    {
      "text": "This report also leaves codes 01-06 out of measurable skill gains. TEGL says the exclusions apply to the six indicators; confirm how your state applies them to MSG.",
      "verified": false,
      "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
    }
  ],
  "apprenticeship": [
    {
      "text": "Term: time-based (at least 2,000 hours of on-the-job learning), competency-based or hybrid. 29 CFR 29.5(b)(2).",
      "verified": true,
      "sourceUrl": "https://www.law.cornell.edu/cfr/text/29/29.5"
    },
    {
      "text": "Related instruction: a minimum of 144 hours for each year of apprenticeship is recommended. 29 CFR 29.5(b)(4).",
      "verified": true,
      "sourceUrl": "https://www.law.cornell.edu/cfr/text/29/29.5"
    },
    {
      "text": "A progressively increasing schedule of wages consistent with the skill acquired. 29 CFR 29.5(b)(5).",
      "verified": true,
      "sourceUrl": "https://www.law.cornell.edu/cfr/text/29/29.5"
    },
    {
      "text": "Periodic review and evaluation of performance on the job and in related instruction. 29 CFR 29.5(b)(6).",
      "verified": true,
      "sourceUrl": "https://www.law.cornell.edu/cfr/text/29/29.5"
    },
    {
      "text": "The completion certificate is issued by the Registration Agency, not the school. 29 CFR 29.5(b)(15).",
      "verified": true,
      "sourceUrl": "https://www.law.cornell.edu/cfr/text/29/29.5"
    },
    {
      "text": "DOL proposed changes to 29 CFR part 29 (NPRM, January 2024, RIN 1205-AC13). Whether a final rule replaced these provisions was not confirmed.",
      "verified": false,
      "sourceUrl": "https://apprenticeship.gov/node/80804"
    },
    {
      "text": "Completing one year of a registered apprenticeship is an example of a training-milestone skill gain; a certificate of completion of an apprenticeship is a recognized postsecondary credential.",
      "verified": true,
      "sourceUrl": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf"
    },
    {
      "text": "RAPIDS registration is done by the sponsor and Registration Agency; this platform does not connect to RAPIDS.",
      "verified": true,
      "sourceUrl": "https://www.apprenticeship.gov"
    }
  ],
  "sources": [
    {
      "title": "DOL ETA: WIOA performance indicators",
      "url": "https://www.dol.gov/agencies/eta/performance/performance-indicators",
      "official": true
    },
    {
      "title": "TEGL 10-16, Change 3 (11 June 2024; rescinds Change 2)",
      "url": "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2023/TEGL%2010-16%20Change%203/TEGL%2010-16%2C%20Change%203.pdf",
      "official": true
    },
    {
      "title": "DOL ETA: performance reporting (Joint PIRL ETA-9170, OMB 1205-0526)",
      "url": "https://www.dol.gov/agencies/eta/performance/reporting",
      "official": true
    },
    {
      "title": "ETA-9170 Joint PIRL (2025 non-material change, accessible PDF)",
      "url": "https://www.dol.gov/sites/dolgov/files/ETA/Performance/pdfs/ETA_9170%20CLEAN%201.20.2026%20(Accessible%20PDF).pdf",
      "official": true
    },
    {
      "title": "20 CFR 677.155 primary indicators (Cornell LII copy of the eCFR text)",
      "url": "https://www.law.cornell.edu/cfr/text/20/677.155",
      "official": false
    }
  ],
  "programs": [
    "Adult",
    "DislocatedWorker",
    "Youth",
    "AdultEducation",
    "WagnerPeyser",
    "VocationalRehabilitation"
  ],
  "trainingTypes": [
    "None",
    "OccupationalSkills",
    "Postsecondary",
    "SecondaryNoDiploma",
    "Apprenticeship",
    "OnTheJob",
    "Customized"
  ],
  "wageSources": [
    "UiWage",
    "Federal",
    "Military",
    "Supplemental",
    "UiWageSwis"
  ],
  "gainTypes": [
    "EducationalFunctioningLevel",
    "SecondaryDiploma",
    "Transcript",
    "TrainingMilestone",
    "SkillsProgression"
  ],
  "exitReasons": [
    "00",
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07"
  ],
  "credentialTypes": [
    1,
    2,
    3,
    4,
    5,
    6,
    7
  ]
};
const wioaReport = {
  "filters": {
    "programYear": 2024,
    "exitFrom": "2024-07-01",
    "exitTo": "2025-06-30",
    "msgFrom": "2024-07-01",
    "msgTo": "2025-06-30",
    "program": null,
    "includeOutcomes": false
  },
  "participants": 7,
  "exiters": 6,
  "excluded": 1,
  "waitingForWageData": 0,
  "fromOutcomes": 0,
  "minCellSize": 10,
  "indicators": [
    {
      "key": "employmentQ2",
      "numerator": 3,
      "denominator": 5,
      "rate": "60.0%",
      "pending": 0
    },
    {
      "key": "employmentQ4",
      "numerator": 2,
      "denominator": 5,
      "rate": "40.0%",
      "pending": 0
    },
    {
      "key": "medianEarningsQ2",
      "count": 2,
      "value": "<10",
      "pending": 0
    },
    {
      "key": "credentialAttainment",
      "numerator": 1,
      "denominator": 2,
      "rate": "50.0%",
      "pending": 0
    },
    {
      "key": "measurableSkillGains",
      "numerator": 2,
      "denominator": 4,
      "rate": "50.0%",
      "pending": 0
    },
    {
      "key": "retention",
      "numerator": 1,
      "denominator": 2,
      "rate": "50.0%",
      "pending": 0
    }
  ],
  "tables": [
    {
      "key": "program",
      "title": "Indicators by program",
      "columns": [
        "Group",
        "Exiters",
        "Employed Q2",
        "Q2 denominator",
        "Employment rate Q2",
        "Employed Q4",
        "Q4 denominator",
        "Employment rate Q4",
        "Median earnings Q2",
        "Credential attainment",
        "Credential denominator",
        "Credential rate",
        "Participants with a skill gain",
        "MSG denominator",
        "MSG rate"
      ],
      "rows": [
        [
          "Adult",
          3,
          1,
          3,
          "33.3%",
          1,
          3,
          "33.3%",
          "<10",
          1,
          2,
          "50.0%",
          2,
          4,
          "50.0%"
        ],
        [
          "DislocatedWorker",
          1,
          1,
          1,
          "100.0%",
          1,
          1,
          "100.0%",
          "<10",
          0,
          0,
          "–",
          0,
          0,
          "–"
        ],
        [
          "Youth",
          1,
          1,
          1,
          "100.0%",
          0,
          1,
          "0.0%",
          null,
          0,
          0,
          "–",
          0,
          0,
          "–"
        ],
        [
          "All programs",
          5,
          3,
          5,
          "60.0%",
          2,
          5,
          "40.0%",
          "<10",
          1,
          2,
          "50.0%",
          2,
          4,
          "50.0%"
        ]
      ],
      "note": "Median earnings are hidden when fewer than 10 participants are employed, because they would reveal a person's wages."
    }
  ],
  "notes": [
    "Exit-based indicators use participants whose date of exit (PIRL 901) is in the chosen range; measurable skill gains use the program year (1 July to 30 June) or the same range.",
    "\"Not yet available\" participants have no wage data for the quarter yet and are left out of the rate, as TEGL 10-16 describes; two quarters later they count as not employed.",
    "Placements recorded in Outcomes are not counted. Turn them on to see verified placements as supplemental employment information.",
    "Credentials include records you entered, short-term credentials marked as recognized, and completed registered apprenticeships.",
    "Skill gains include gains you entered, secondary diplomas, and sponsor-signed apprenticeship progress reviews and completed years.",
    "This platform cannot access state unemployment-insurance (UI) wage records, WRIS/SWIS or federal and military employment records. Employment and earnings come only from quarterly wage data that your staff enter or import (from the state's match results or from supplemental wage information with source documents). Until a quarter's data is entered, that participant is shown as \"not yet available\".",
    "Verify against the current PIRL/ETA format before submitting. This export is a working summary built from records your school entered or imported; it is not an official ETA-9170 file and does not show compliance."
  ],
  "verifyFormat": "Verify against the current PIRL/ETA format before submitting. This export is a working summary built from records your school entered or imported; it is not an official ETA-9170 file and does not show compliance.",
  "wageGap": "This platform cannot access state unemployment-insurance (UI) wage records, WRIS/SWIS or federal and military employment records. Employment and earnings come only from quarterly wage data that your staff enter or import (from the state's match results or from supplemental wage information with source documents). Until a quarter's data is entered, that participant is shown as \"not yet available\"."
};
const participants = [
  {
    "id": "76d4f369-5869-422b-9892-8b48d44728ea",
    "studentUserId": "4be3dbc9-789b-472b-94e3-5868e22130f1",
    "studentName": "Student 0",
    "studentEmail": "s0@lakeside.example",
    "studentNumber": "W0",
    "program": "Adult",
    "localId": null,
    "entryDate": "2025-01-10",
    "exitDate": null,
    "exitReasonCode": "00",
    "trainingType": "Apprenticeship",
    "trainingEnrolledDate": "2025-01-15",
    "trainingCompletedDate": null,
    "youthEducationQ2": false,
    "youthEducationQ4": false,
    "postsecondaryWithinYear": false,
    "notes": null,
    "updatedAt": "2026-10-16T00:35:37.689877Z"
  },
  {
    "id": "84f7dca6-3143-43f4-9e8c-43bdd2e54dd0",
    "studentUserId": "da089b1b-cc73-4cee-ae09-0c7b1eb9697e",
    "studentName": "Student 6",
    "studentEmail": "s6@lakeside.example",
    "studentNumber": "W6",
    "program": "Adult",
    "localId": null,
    "entryDate": "2024-12-01",
    "exitDate": "2025-02-10",
    "exitReasonCode": "00",
    "trainingType": "OnTheJob",
    "trainingEnrolledDate": "2024-12-01",
    "trainingCompletedDate": null,
    "youthEducationQ2": false,
    "youthEducationQ4": false,
    "postsecondaryWithinYear": false,
    "notes": null,
    "updatedAt": "2026-10-16T00:35:37.675527Z"
  },
  {
    "id": "e1917cf3-f2c5-403e-89ca-28892ed6146a",
    "studentUserId": "23ee6967-eafc-42c3-abe9-34be90adcb3f",
    "studentName": "Student 5",
    "studentEmail": "s5@lakeside.example",
    "studentNumber": "W5",
    "program": "Youth",
    "localId": null,
    "entryDate": "2024-04-01",
    "exitDate": "2024-12-15",
    "exitReasonCode": "00",
    "trainingType": "None",
    "trainingEnrolledDate": null,
    "trainingCompletedDate": null,
    "youthEducationQ2": true,
    "youthEducationQ4": false,
    "postsecondaryWithinYear": false,
    "notes": null,
    "updatedAt": "2026-10-16T00:35:37.659823Z"
  },
  {
    "id": "63cebb33-dcd1-48c6-b4c7-5cf2b6de4937",
    "studentUserId": "d467d0e6-f344-4940-9f76-56aab1ee361d",
    "studentName": "Student 3",
    "studentEmail": "s3@lakeside.example",
    "studentNumber": "W3",
    "program": "DislocatedWorker",
    "localId": null,
    "entryDate": "2024-03-01",
    "exitDate": "2024-10-20",
    "exitReasonCode": "00",
    "trainingType": "None",
    "trainingEnrolledDate": null,
    "trainingCompletedDate": null,
    "youthEducationQ2": false,
    "youthEducationQ4": false,
    "postsecondaryWithinYear": false,
    "notes": null,
    "updatedAt": "2026-10-16T00:35:37.627196Z"
  },
  {
    "id": "f3099bba-27e6-4fa4-b79e-d6b81c539357",
    "studentUserId": "0a909b9e-68c1-4d7a-8e68-0316f44762d0",
    "studentName": "Student 4",
    "studentEmail": "s4@lakeside.example",
    "studentNumber": "W4",
    "program": "Adult",
    "localId": null,
    "entryDate": "2024-03-01",
    "exitDate": "2024-11-01",
    "exitReasonCode": "03",
    "trainingType": "None",
    "trainingEnrolledDate": null,
    "trainingCompletedDate": null,
    "youthEducationQ2": false,
    "youthEducationQ4": false,
    "postsecondaryWithinYear": false,
    "notes": null,
    "updatedAt": "2026-10-16T00:35:37.643771Z"
  },
  {
    "id": "58a1dee9-d515-4353-a3b9-e1d8b18391b5",
    "studentUserId": "5e1cc431-2128-48d3-883b-1a713653f1d5",
    "studentName": "Student 2",
    "studentEmail": "s2@lakeside.example",
    "studentNumber": "W2",
    "program": "Adult",
    "localId": null,
    "entryDate": "2024-02-01",
    "exitDate": "2024-09-30",
    "exitReasonCode": "00",
    "trainingType": "OccupationalSkills",
    "trainingEnrolledDate": "2024-02-01",
    "trainingCompletedDate": null,
    "youthEducationQ2": false,
    "youthEducationQ4": false,
    "postsecondaryWithinYear": false,
    "notes": null,
    "updatedAt": "2026-10-16T00:35:37.607Z"
  },
  {
    "id": "45f5bc99-3d1d-41f2-9d42-6d144ab9c6fd",
    "studentUserId": "904c6a59-6c57-499a-9690-cc1146e41899",
    "studentName": "Student 1",
    "studentEmail": "s1@lakeside.example",
    "studentNumber": "W1",
    "program": "Adult",
    "localId": "L-001",
    "entryDate": "2024-01-05",
    "exitDate": "2024-08-15",
    "exitReasonCode": "00",
    "trainingType": "Postsecondary",
    "trainingEnrolledDate": "2024-01-10",
    "trainingCompletedDate": null,
    "youthEducationQ2": false,
    "youthEducationQ4": false,
    "postsecondaryWithinYear": false,
    "notes": null,
    "updatedAt": "2026-10-16T00:35:37.513071Z"
  }
];
const participant = {
  "participant": {
    "id": "45f5bc99-3d1d-41f2-9d42-6d144ab9c6fd",
    "studentUserId": "904c6a59-6c57-499a-9690-cc1146e41899",
    "studentName": "Student 1",
    "studentEmail": "s1@lakeside.example",
    "studentNumber": "W1",
    "program": "Adult",
    "localId": "L-001",
    "entryDate": "2024-01-05",
    "exitDate": "2024-08-15",
    "exitReasonCode": "00",
    "trainingType": "Postsecondary",
    "trainingEnrolledDate": "2024-01-10",
    "trainingCompletedDate": null,
    "youthEducationQ2": false,
    "youthEducationQ4": false,
    "postsecondaryWithinYear": false,
    "notes": null,
    "updatedAt": "2026-10-16T00:35:37.513071Z"
  },
  "wages": [
    {
      "id": "14f7d6a5-bb84-478a-bc55-15857dcc15f9",
      "year": 2025,
      "quarter": 3,
      "amount": 5200,
      "source": "UiWage",
      "employerName": null,
      "employerKey": "E1",
      "sourceDocument": null,
      "enteredVia": "Staff",
      "createdAt": "2026-10-16T00:35:37.980777Z"
    },
    {
      "id": "460f1ecb-c300-433b-b39d-798000e92647",
      "year": 2025,
      "quarter": 1,
      "amount": 5000,
      "source": "UiWage",
      "employerName": "Grid Co",
      "employerKey": "E1",
      "sourceDocument": null,
      "enteredVia": "Staff",
      "createdAt": "2026-10-16T00:35:37.915503Z"
    }
  ],
  "credentials": [
    {
      "id": "c10ff89e-3368-4fa4-bfd0-0aec0af9269e",
      "typeCode": 6,
      "name": "Journeyman electrician prep certification",
      "attainedOn": "2025-03-01",
      "origin": "Recorded",
      "note": null
    }
  ],
  "gains": [
    {
      "id": "b17282f6-9634-4222-81e5-37361c959ba9",
      "gainType": "Transcript",
      "achievedOn": "2024-07-20",
      "origin": "Recorded",
      "note": null
    }
  ],
  "quarters": {
    "q2": {
      "quarter": "2025-Q1",
      "status": "Employed",
      "earnings": 5000,
      "source": "UiWage"
    },
    "q4": {
      "quarter": "2025-Q3",
      "status": "Employed",
      "earnings": 5200,
      "source": "UiWage"
    }
  },
  "placements": []
};
const credentials = {
  "achievementTypes": [
    "Certificate",
    "CertificateOfCompletion",
    "Certification",
    "License",
    "MicroCredential",
    "Badge",
    "Course",
    "ApprenticeshipCertificate",
    "Competency"
  ],
  "credentials": [
    {
      "id": "2a6e30b3-2662-42d7-aff2-db4c68365936",
      "name": "Forklift operator certification",
      "description": "Operates counterbalance forklifts safely.",
      "criteria": "Pass the written and practical evaluation.",
      "achievementType": "Certification",
      "contactHours": 40,
      "programCode": "FORK-101",
      "wioaRecognized": true,
      "pirlTypeCode": 6,
      "validMonths": 36,
      "active": true,
      "awarded": 0
    }
  ]
};
const awards = [
  {
    "id": "2846753f-a255-4acf-8bf5-e0c290c5ac31",
    "studentUserId": "5e1cc431-2128-48d3-883b-1a713653f1d5",
    "studentName": "Student 2",
    "studentEmail": "s2@lakeside.example",
    "awardedOn": "2025-06-01",
    "evidence": "Practical eval 2025-05-30",
    "revokedAt": "2026-10-16T00:35:39.567515Z",
    "revokeReason": "Issued in error"
  }
];
const apprenticeships = [
  {
    "id": "d85e0423-b8b3-4043-a4df-6734e77c07cd",
    "studentName": "Student 0",
    "occupation": "Electrician",
    "sponsorName": "Acme Robotics",
    "status": "Active",
    "startDate": "2026-01-05",
    "expectedEndDate": "2028-01-05",
    "registrationNumber": "RA-TX-2026-001",
    "pendingSignoffs": 0,
    "pendingHours": 0
  }
];
const apprenticeship = {
  "id": "d85e0423-b8b3-4043-a4df-6734e77c07cd",
  "studentUserId": "4be3dbc9-789b-472b-94e3-5868e22130f1",
  "studentName": "Student 0",
  "experienceId": "b3f7e9f7-083e-4880-a80c-d827fc9a065f",
  "employerId": null,
  "occupation": "Electrician",
  "occupationCode": "0159",
  "registrationNumber": "RA-TX-2026-001",
  "registrationAgency": "OA",
  "sponsorName": "Acme Robotics",
  "sponsorContactName": "Sam Supervisor",
  "sponsorContactEmail": "sam@acme.example",
  "approach": "TimeBased",
  "startDate": "2026-01-05",
  "expectedEndDate": "2028-01-05",
  "ojlHoursRequired": 1500,
  "rtiHoursRequired": 288,
  "journeyworkerWage": 32,
  "wageSchedule": [
    {
      "step": 1,
      "afterOjlHours": 0,
      "afterMonths": null,
      "rate": 18
    },
    {
      "step": 2,
      "afterOjlHours": 1000,
      "afterMonths": null,
      "rate": 20
    },
    {
      "step": 3,
      "afterOjlHours": 2000,
      "afterMonths": null,
      "rate": 22
    }
  ],
  "status": "Active",
  "completedAt": null,
  "sponsorConsent": true,
  "progress": {
    "ojlHours": 1080,
    "ojlFromExperience": 80,
    "ojlStaffEntered": 1000,
    "rtiHours": 6,
    "rtiPending": 0,
    "ojlPercent": 72,
    "rtiPercent": 2,
    "currentRate": 20,
    "currentStep": 2,
    "percentOfJourneyworker": 62,
    "monthsElapsed": 9,
    "stepsDue": []
  },
  "warnings": [
    "Time-based apprenticeships need at least 2,000 hours of on-the-job learning (29 CFR 29.5(b)(2)). Check the registered standards."
  ],
  "hours": [
    {
      "id": "e36b38c1-a772-471b-9e36-64d737c5a4fc",
      "kind": "OJL",
      "date": "2026-09-30",
      "hours": 300,
      "description": "Timesheets",
      "source": "Staff",
      "status": "Approved",
      "decisionNote": null
    },
    {
      "id": "aca9d406-bf1c-4176-b5b3-0dd94552e851",
      "kind": "OJL",
      "date": "2026-09-30",
      "hours": 300,
      "description": "Timesheets",
      "source": "Staff",
      "status": "Approved",
      "decisionNote": null
    },
    {
      "id": "e954d419-22db-4386-992b-b9531b833812",
      "kind": "OJL",
      "date": "2026-09-30",
      "hours": 400,
      "description": "Sponsor timesheets Jan-Sep",
      "source": "Staff",
      "status": "Approved",
      "decisionNote": null
    },
    {
      "id": "641ae10c-3b93-48f5-8faf-e1d45c0315f1",
      "kind": "RTI",
      "date": "2026-02-08",
      "hours": 4,
      "description": "Code book",
      "source": "Student",
      "status": "Rejected",
      "decisionNote": "Wrong date"
    },
    {
      "id": "792e526d-17a7-457f-8535-afbb25dda3ec",
      "kind": "RTI",
      "date": "2026-02-01",
      "hours": 6,
      "description": "Electrical theory 101",
      "source": "Student",
      "status": "Approved",
      "decisionNote": null
    }
  ],
  "wages": [
    {
      "id": "ee96c959-4803-4039-b36c-51bf331d88c1",
      "effectiveDate": "2026-10-16",
      "hourlyRate": 20,
      "step": 2,
      "note": null,
      "source": "SponsorSignoff"
    },
    {
      "id": "6699198b-cbf5-492d-9034-5ee53e213d85",
      "effectiveDate": "2026-01-05",
      "hourlyRate": 18,
      "step": 1,
      "note": null,
      "source": "Staff"
    }
  ],
  "signoffs": [
    {
      "id": "d4aef4cb-8af0-4b0e-b60b-9294a1fb3923",
      "kind": "Completion",
      "statement": "Registered apprenticeship: Electrician (0159). Apprentice: Student 0. Sponsor: Acme Robotics. Registration number: RA-TX-2026-001.\n\nAs the sponsor's representative, I confirm that the apprentice has completed the on-the-job learning and related instruction required by the registered standards as of 2026-10-16. Recorded: 1080 on-the-job learning hours and 6 related instruction hours. I understand that the completion certificate is issued by the Registration Agency.",
      "proposedRate": null,
      "proposedStep": null,
      "status": "Approved",
      "signerName": "Sam Supervisor",
      "signedAt": "2026-10-16T00:35:41.467091Z",
      "issuedAt": "2026-10-16T00:35:41.434424Z",
      "expiresAt": "2026-11-15T00:35:41.434448Z",
      "revoked": false,
      "sponsorNote": null
    },
    {
      "id": "e5bda4f8-dc44-4553-b685-842fdbd134f5",
      "kind": "ProgressReview",
      "statement": "Registered apprenticeship: Electrician (0159). Apprentice: Student 0. Sponsor: Acme Robotics. Registration number: RA-TX-2026-001.\n\nAs the sponsor's representative, I confirm that as of 2026-10-16 the apprentice is making satisfactory or better progress on the job and in related instruction. Recorded: 1080 on-the-job learning hours and 6 related instruction hours.",
      "proposedRate": null,
      "proposedStep": null,
      "status": "Pending",
      "signerName": null,
      "signedAt": null,
      "issuedAt": "2026-10-16T00:35:41.322787Z",
      "expiresAt": "2026-11-15T00:35:41.32282Z",
      "revoked": true,
      "sponsorNote": null
    },
    {
      "id": "916042c0-c4a9-46dd-a022-9f31be19696a",
      "kind": "ProgressReview",
      "statement": "Registered apprenticeship: Electrician (0159). Apprentice: Student 0. Sponsor: Acme Robotics. Registration number: RA-TX-2026-001.\n\nAs the sponsor's representative, I confirm that as of 2026-10-16 the apprentice is making satisfactory or better progress on the job and in related instruction. Recorded: 1080 on-the-job learning hours and 6 related instruction hours.",
      "proposedRate": null,
      "proposedStep": null,
      "status": "Pending",
      "signerName": null,
      "signedAt": null,
      "issuedAt": "2026-10-16T00:35:41.263332Z",
      "expiresAt": "2026-11-15T00:35:41.263356Z",
      "revoked": true,
      "sponsorNote": null
    },
    {
      "id": "1b02268b-2427-41ea-a8c3-fb2acba73fcf",
      "kind": "YearCompleted",
      "statement": "Registered apprenticeship: Electrician (0159). Apprentice: Student 0. Sponsor: Acme Robotics. Registration number: RA-TX-2026-001.\n\nAs the sponsor's representative, I confirm that the apprentice has satisfactorily completed year 1 of the apprenticeship as of 2026-10-16. Recorded: 1080 on-the-job learning hours and 6 related instruction hours.",
      "proposedRate": null,
      "proposedStep": null,
      "status": "Declined",
      "signerName": "Sam Supervisor",
      "signedAt": "2026-10-16T00:35:41.203605Z",
      "issuedAt": "2026-10-16T00:35:41.160343Z",
      "expiresAt": "2026-11-15T00:35:41.160371Z",
      "revoked": false,
      "sponsorNote": "Year ends in January"
    },
    {
      "id": "b17ca4d2-92e8-450e-aad5-eb3aa5009836",
      "kind": "ProgressReview",
      "statement": "Registered apprenticeship: Electrician (0159). Apprentice: Student 0. Sponsor: Acme Robotics. Registration number: RA-TX-2026-001.\n\nAs the sponsor's representative, I confirm that as of 2026-10-16 the apprentice is making satisfactory or better progress on the job and in related instruction. Recorded: 1080 on-the-job learning hours and 6 related instruction hours.",
      "proposedRate": null,
      "proposedStep": null,
      "status": "Approved",
      "signerName": "Sam Supervisor",
      "signedAt": "2026-10-16T00:35:41.090958Z",
      "issuedAt": "2026-10-16T00:35:41.053658Z",
      "expiresAt": "2026-11-15T00:35:41.053683Z",
      "revoked": false,
      "sponsorNote": null
    },
    {
      "id": "2f4130e2-25e4-4bd2-9648-42931c8d1f7b",
      "kind": "WageIncrease",
      "statement": "Registered apprenticeship: Electrician (0159). Apprentice: Student 0. Sponsor: Acme Robotics. Registration number: RA-TX-2026-001.\n\nAs the sponsor's representative, I confirm a wage increase to 20.00 per hour (wage schedule step 2), effective 2026-10-16, consistent with the skill acquired.",
      "proposedRate": 20,
      "proposedStep": 2,
      "status": "Approved",
      "signerName": "Sam Supervisor",
      "signedAt": "2026-10-16T00:35:40.999809Z",
      "issuedAt": "2026-10-16T00:35:40.772185Z",
      "expiresAt": "2026-11-15T00:35:40.772622Z",
      "revoked": false,
      "sponsorNote": null
    }
  ]
};
const myApprenticeships = {
  "apprenticeships": [
    {
      "id": "d85e0423-b8b3-4043-a4df-6734e77c07cd",
      "studentUserId": "4be3dbc9-789b-472b-94e3-5868e22130f1",
      "studentName": "Student 0",
      "experienceId": "b3f7e9f7-083e-4880-a80c-d827fc9a065f",
      "employerId": null,
      "occupation": "Electrician",
      "occupationCode": "0159",
      "registrationNumber": "RA-TX-2026-001",
      "registrationAgency": "OA",
      "sponsorName": "Acme Robotics",
      "sponsorContactName": "Sam Supervisor",
      "sponsorContactEmail": null,
      "approach": "TimeBased",
      "startDate": "2026-01-05",
      "expectedEndDate": "2028-01-05",
      "ojlHoursRequired": 1500,
      "rtiHoursRequired": 288,
      "journeyworkerWage": 32,
      "wageSchedule": [
        {
          "step": 1,
          "afterOjlHours": 0,
          "afterMonths": null,
          "rate": 18
        },
        {
          "step": 2,
          "afterOjlHours": 1000,
          "afterMonths": null,
          "rate": 20
        },
        {
          "step": 3,
          "afterOjlHours": 2000,
          "afterMonths": null,
          "rate": 22
        }
      ],
      "status": "Active",
      "completedAt": null,
      "sponsorConsent": true,
      "progress": {
        "ojlHours": 1080,
        "ojlFromExperience": 80,
        "ojlStaffEntered": 1000,
        "rtiHours": 6,
        "rtiPending": 0,
        "ojlPercent": 72,
        "rtiPercent": 2,
        "currentRate": 20,
        "currentStep": 2,
        "percentOfJourneyworker": 62,
        "monthsElapsed": 9,
        "stepsDue": []
      },
      "warnings": [],
      "hours": [
        {
          "id": "e36b38c1-a772-471b-9e36-64d737c5a4fc",
          "kind": "OJL",
          "date": "2026-09-30",
          "hours": 300,
          "description": "Timesheets",
          "source": "Staff",
          "status": "Approved",
          "decisionNote": null
        },
        {
          "id": "aca9d406-bf1c-4176-b5b3-0dd94552e851",
          "kind": "OJL",
          "date": "2026-09-30",
          "hours": 300,
          "description": "Timesheets",
          "source": "Staff",
          "status": "Approved",
          "decisionNote": null
        },
        {
          "id": "e954d419-22db-4386-992b-b9531b833812",
          "kind": "OJL",
          "date": "2026-09-30",
          "hours": 400,
          "description": "Sponsor timesheets Jan-Sep",
          "source": "Staff",
          "status": "Approved",
          "decisionNote": null
        },
        {
          "id": "641ae10c-3b93-48f5-8faf-e1d45c0315f1",
          "kind": "RTI",
          "date": "2026-02-08",
          "hours": 4,
          "description": "Code book",
          "source": "Student",
          "status": "Rejected",
          "decisionNote": "Wrong date"
        },
        {
          "id": "792e526d-17a7-457f-8535-afbb25dda3ec",
          "kind": "RTI",
          "date": "2026-02-01",
          "hours": 6,
          "description": "Electrical theory 101",
          "source": "Student",
          "status": "Approved",
          "decisionNote": null
        }
      ],
      "wages": [
        {
          "id": "ee96c959-4803-4039-b36c-51bf331d88c1",
          "effectiveDate": "2026-10-16",
          "hourlyRate": 20,
          "step": 2,
          "note": null,
          "source": "SponsorSignoff"
        },
        {
          "id": "6699198b-cbf5-492d-9034-5ee53e213d85",
          "effectiveDate": "2026-01-05",
          "hourlyRate": 18,
          "step": 1,
          "note": null,
          "source": "Staff"
        }
      ],
      "signoffs": [
        {
          "id": "d4aef4cb-8af0-4b0e-b60b-9294a1fb3923",
          "kind": "Completion",
          "statement": "Registered apprenticeship: Electrician (0159). Apprentice: Student 0. Sponsor: Acme Robotics. Registration number: RA-TX-2026-001.\n\nAs the sponsor's representative, I confirm that the apprentice has completed the on-the-job learning and related instruction required by the registered standards as of 2026-10-16. Recorded: 1080 on-the-job learning hours and 6 related instruction hours. I understand that the completion certificate is issued by the Registration Agency.",
          "proposedRate": null,
          "proposedStep": null,
          "status": "Approved",
          "signerName": "Sam Supervisor",
          "signedAt": "2026-10-16T00:35:41.467091Z",
          "issuedAt": "2026-10-16T00:35:41.434424Z",
          "expiresAt": "2026-11-15T00:35:41.434448Z",
          "revoked": false,
          "sponsorNote": null
        },
        {
          "id": "e5bda4f8-dc44-4553-b685-842fdbd134f5",
          "kind": "ProgressReview",
          "statement": "Registered apprenticeship: Electrician (0159). Apprentice: Student 0. Sponsor: Acme Robotics. Registration number: RA-TX-2026-001.\n\nAs the sponsor's representative, I confirm that as of 2026-10-16 the apprentice is making satisfactory or better progress on the job and in related instruction. Recorded: 1080 on-the-job learning hours and 6 related instruction hours.",
          "proposedRate": null,
          "proposedStep": null,
          "status": "Pending",
          "signerName": null,
          "signedAt": null,
          "issuedAt": "2026-10-16T00:35:41.322787Z",
          "expiresAt": "2026-11-15T00:35:41.32282Z",
          "revoked": true,
          "sponsorNote": null
        },
        {
          "id": "916042c0-c4a9-46dd-a022-9f31be19696a",
          "kind": "ProgressReview",
          "statement": "Registered apprenticeship: Electrician (0159). Apprentice: Student 0. Sponsor: Acme Robotics. Registration number: RA-TX-2026-001.\n\nAs the sponsor's representative, I confirm that as of 2026-10-16 the apprentice is making satisfactory or better progress on the job and in related instruction. Recorded: 1080 on-the-job learning hours and 6 related instruction hours.",
          "proposedRate": null,
          "proposedStep": null,
          "status": "Pending",
          "signerName": null,
          "signedAt": null,
          "issuedAt": "2026-10-16T00:35:41.263332Z",
          "expiresAt": "2026-11-15T00:35:41.263356Z",
          "revoked": true,
          "sponsorNote": null
        },
        {
          "id": "1b02268b-2427-41ea-a8c3-fb2acba73fcf",
          "kind": "YearCompleted",
          "statement": "Registered apprenticeship: Electrician (0159). Apprentice: Student 0. Sponsor: Acme Robotics. Registration number: RA-TX-2026-001.\n\nAs the sponsor's representative, I confirm that the apprentice has satisfactorily completed year 1 of the apprenticeship as of 2026-10-16. Recorded: 1080 on-the-job learning hours and 6 related instruction hours.",
          "proposedRate": null,
          "proposedStep": null,
          "status": "Declined",
          "signerName": "Sam Supervisor",
          "signedAt": "2026-10-16T00:35:41.203605Z",
          "issuedAt": "2026-10-16T00:35:41.160343Z",
          "expiresAt": "2026-11-15T00:35:41.160371Z",
          "revoked": false,
          "sponsorNote": "Year ends in January"
        },
        {
          "id": "b17ca4d2-92e8-450e-aad5-eb3aa5009836",
          "kind": "ProgressReview",
          "statement": "Registered apprenticeship: Electrician (0159). Apprentice: Student 0. Sponsor: Acme Robotics. Registration number: RA-TX-2026-001.\n\nAs the sponsor's representative, I confirm that as of 2026-10-16 the apprentice is making satisfactory or better progress on the job and in related instruction. Recorded: 1080 on-the-job learning hours and 6 related instruction hours.",
          "proposedRate": null,
          "proposedStep": null,
          "status": "Approved",
          "signerName": "Sam Supervisor",
          "signedAt": "2026-10-16T00:35:41.090958Z",
          "issuedAt": "2026-10-16T00:35:41.053658Z",
          "expiresAt": "2026-11-15T00:35:41.053683Z",
          "revoked": false,
          "sponsorNote": null
        },
        {
          "id": "2f4130e2-25e4-4bd2-9648-42931c8d1f7b",
          "kind": "WageIncrease",
          "statement": "Registered apprenticeship: Electrician (0159). Apprentice: Student 0. Sponsor: Acme Robotics. Registration number: RA-TX-2026-001.\n\nAs the sponsor's representative, I confirm a wage increase to 20.00 per hour (wage schedule step 2), effective 2026-10-16, consistent with the skill acquired.",
          "proposedRate": 20,
          "proposedStep": 2,
          "status": "Approved",
          "signerName": "Sam Supervisor",
          "signedAt": "2026-10-16T00:35:40.999809Z",
          "issuedAt": "2026-10-16T00:35:40.772185Z",
          "expiresAt": "2026-11-15T00:35:40.772622Z",
          "revoked": false,
          "sponsorNote": null
        }
      ]
    }
  ]
};
const myCredentials = {
  "signingAvailable": true,
  "awards": [
    {
      "id": "2846753f-a255-4acf-8bf5-e0c290c5ac31",
      "name": "Forklift operator certification",
      "achievementType": "Certification",
      "contactHours": 40,
      "awardedOn": "2025-06-01",
      "revoked": false,
      "validUntil": "2028-06-01"
    }
  ]
};
const cirrDefinitions = {
  "reviewedOn": "2026-10-16",
  "verifyFormat": "CIRR-style working report. Official CIRR reports are produced in the CIRR Outcomes Report Template spreadsheet, audited by a CIRR-approved auditor and published by CIRR. This report is not a CIRR report and does not show CIRR membership.",
  "label": "CIRR-style",
  "rules": [
    {
      "text": "CIRR is active: cirr.org shows a 2025 report cycle and links the Standards rev. 2025-01-06.",
      "verified": true,
      "sourceUrl": "https://cirr.org/our-standards"
    },
    {
      "text": "Outcome categories 1A, 1B, 1C, 1D, 2A, 2B, 2C, 3 (still seeking), 4 (could not contact) and Excluded.",
      "verified": true,
      "sourceUrl": "https://drive.google.com/file/d/1zuNf-58OcxVyY1KnTxnfqhfftiNexb6S/view?usp=sharing"
    },
    {
      "text": "Graduates who did not intend a new in-field job within 360 days, or are not authorized to work in the country of study, are Excluded; everyone else starts as \"Still seeking\".",
      "verified": true,
      "sourceUrl": "https://drive.google.com/file/d/1zuNf-58OcxVyY1KnTxnfqhfftiNexb6S/view?usp=sharing"
    },
    {
      "text": "Any outcome other than \"Still seeking\" needs documentation from the graduate, the employer, a third-party recruiter or a credentialed employment-history service.",
      "verified": true,
      "sourceUrl": "https://drive.google.com/file/d/1zuNf-58OcxVyY1KnTxnfqhfftiNexb6S/view?usp=sharing"
    },
    {
      "text": "\"Could not contact\" needs at least 4 attempts through 2 different means.",
      "verified": true,
      "sourceUrl": "https://drive.google.com/file/d/1zuNf-58OcxVyY1KnTxnfqhfftiNexb6S/view?usp=sharing"
    },
    {
      "text": "Job outcomes need an offer or start date, a paid offer and acceptance; use the earlier of offer and start date.",
      "verified": true,
      "sourceUrl": "https://drive.google.com/file/d/1zuNf-58OcxVyY1KnTxnfqhfftiNexb6S/view?usp=sharing"
    },
    {
      "text": "Salary is base compensation only. Any salary claim must state the share of all graduates who reported a salary.",
      "verified": true,
      "sourceUrl": "https://drive.google.com/file/d/1zuNf-58OcxVyY1KnTxnfqhfftiNexb6S/view?usp=sharing"
    },
    {
      "text": "On-time graduation = within 100% of the published program length.",
      "verified": true,
      "sourceUrl": "https://drive.google.com/file/d/1zuNf-58OcxVyY1KnTxnfqhfftiNexb6S/view?usp=sharing"
    },
    {
      "text": "Current CIRR standards track job outcomes up to 360 days after graduation. Earlier CIRR versions reported 90- and 180-day placement; this report shows 90, 180 and 360 days, and the 90- and 180-day figures are not part of the current standard.",
      "verified": false,
      "sourceUrl": "https://cirr.org/for-schools"
    },
    {
      "text": "The exact columns of the CIRR Outcomes Report Template spreadsheet were not seen; this export does not follow the template.",
      "verified": false,
      "sourceUrl": "https://drive.google.com/file/d/1zuNf-58OcxVyY1KnTxnfqhfftiNexb6S/view?usp=sharing"
    }
  ],
  "sources": [
    {
      "title": "CIRR: Our standards",
      "url": "https://cirr.org/our-standards",
      "official": true
    },
    {
      "title": "CIRR: For schools",
      "url": "https://cirr.org/for-schools",
      "official": true
    },
    {
      "title": "CIRR Standards and Implementation, rev. 2025-01-06 (linked from cirr.org)",
      "url": "https://drive.google.com/file/d/1zuNf-58OcxVyY1KnTxnfqhfftiNexb6S/view?usp=sharing",
      "official": true
    },
    {
      "title": "BLS: 2018 SOC major groups",
      "url": "https://www.bls.gov/soc/2018/major_groups.htm",
      "official": true
    }
  ],
  "categories": [
    {
      "code": "1A",
      "label": "Full-time employee"
    },
    {
      "code": "1B",
      "label": "Full-time apprenticeship, internship, or contract position"
    },
    {
      "code": "1C",
      "label": "Short-term contract, part-time position, freelance, or unknown length"
    },
    {
      "code": "1D",
      "label": "Started a new company or venture after graduation"
    },
    {
      "code": "2A",
      "label": "Employed out-of-field"
    },
    {
      "code": "2B",
      "label": "Continuing to higher education"
    },
    {
      "code": "2C",
      "label": "Not seeking a job for health, family, or personal reasons"
    },
    {
      "code": "3",
      "label": "Still seeking a job in-field"
    },
    {
      "code": "4",
      "label": "Could not contact"
    },
    {
      "code": "Excluded",
      "label": "Excluded"
    }
  ],
  "documentationSources": [
    "Graduate",
    "Employer",
    "Recruiter",
    "EmploymentHistoryService",
    "LinkedInScreenshot"
  ],
  "intents": [
    "NewInFieldJob",
    "StayWithEmployer",
    "SelfEnrichment",
    "ContinueEducation"
  ],
  "windows": [
    90,
    180,
    360
  ]
};
const cohorts = [
  {
    "id": "bdd3cddb-ed67-4f8c-b1f2-5ef6ff562246",
    "name": "Winter 2025",
    "programName": "Full-stack web",
    "kind": "FixedLength",
    "startDate": "2025-01-06",
    "publishedLengthDays": 84,
    "onTimeBy": "2025-03-31",
    "notes": null,
    "members": 7
  }
];
const cohort = {
  "cohort": {
    "id": "bdd3cddb-ed67-4f8c-b1f2-5ef6ff562246",
    "name": "Winter 2025",
    "programName": "Full-stack web",
    "kind": "FixedLength",
    "startDate": "2025-01-06",
    "publishedLengthDays": 84,
    "onTimeBy": "2025-03-31",
    "notes": null,
    "members": 7
  },
  "members": [
    {
      "id": "60a5953d-6d88-410d-ad53-670e3c220039",
      "studentUserId": "d6960412-e13b-438f-ad1a-02abd3ef2bda",
      "studentName": "Student 10",
      "studentEmail": "s10@lakeside.example",
      "enrollmentStatus": "NotCounted",
      "graduationDate": null,
      "intent": null,
      "authorizedStudyCountry": null,
      "authorizedSearchCountry": null,
      "intentRecordedAt": null,
      "hiredBySchool": false,
      "outcomeCategory": null,
      "effectiveCategory": null,
      "offerOrStartDate": null,
      "paid": null,
      "inField": null,
      "baseSalary": null,
      "employerName": null,
      "jobTitle": null,
      "socCode": null,
      "documentationSource": null,
      "documentationNote": null,
      "contactAttempts": 0,
      "contactMethods": 0,
      "updatedAt": "2026-10-16T00:35:42.111141Z"
    },
    {
      "id": "cceca0ea-5103-440e-96de-f45288abdd60",
      "studentUserId": "d467d0e6-f344-4940-9f76-56aab1ee361d",
      "studentName": "Student 3",
      "studentEmail": "s3@lakeside.example",
      "enrollmentStatus": "Graduated",
      "graduationDate": "2025-03-28",
      "intent": "NewInFieldJob",
      "authorizedStudyCountry": true,
      "authorizedSearchCountry": true,
      "intentRecordedAt": "2026-10-16T00:35:42.02618Z",
      "hiredBySchool": false,
      "outcomeCategory": "1A",
      "effectiveCategory": "1A",
      "offerOrStartDate": "2025-04-20",
      "paid": true,
      "inField": null,
      "baseSalary": 80000,
      "employerName": "Webby",
      "jobTitle": "Developer",
      "socCode": "15-1252",
      "documentationSource": "Employer",
      "documentationNote": null,
      "contactAttempts": 0,
      "contactMethods": 0,
      "updatedAt": "2026-10-16T00:35:42.02672Z"
    },
    {
      "id": "e8505935-7ab4-4bc2-88f2-da65fd52c268",
      "studentUserId": "0a909b9e-68c1-4d7a-8e68-0316f44762d0",
      "studentName": "Student 4",
      "studentEmail": "s4@lakeside.example",
      "enrollmentStatus": "Graduated",
      "graduationDate": "2025-03-31",
      "intent": "NewInFieldJob",
      "authorizedStudyCountry": true,
      "authorizedSearchCountry": true,
      "intentRecordedAt": "2026-10-16T00:35:42.057757Z",
      "hiredBySchool": false,
      "outcomeCategory": "1B",
      "effectiveCategory": "1B",
      "offerOrStartDate": "2025-06-15",
      "paid": true,
      "inField": null,
      "baseSalary": 60000,
      "employerName": null,
      "jobTitle": null,
      "socCode": "15-1211",
      "documentationSource": "Graduate",
      "documentationNote": null,
      "contactAttempts": 0,
      "contactMethods": 0,
      "updatedAt": "2026-10-16T00:35:42.057759Z"
    },
    {
      "id": "332bb865-aa14-4867-a10a-75f1c73da053",
      "studentUserId": "23ee6967-eafc-42c3-abe9-34be90adcb3f",
      "studentName": "Student 5",
      "studentEmail": "s5@lakeside.example",
      "enrollmentStatus": "Graduated",
      "graduationDate": "2025-04-20",
      "intent": "NewInFieldJob",
      "authorizedStudyCountry": true,
      "authorizedSearchCountry": true,
      "intentRecordedAt": "2026-10-16T00:35:42.070383Z",
      "hiredBySchool": false,
      "outcomeCategory": "1C",
      "effectiveCategory": "1C",
      "offerOrStartDate": "2025-08-01",
      "paid": true,
      "inField": null,
      "baseSalary": null,
      "employerName": null,
      "jobTitle": null,
      "socCode": "27-1024",
      "documentationSource": "Recruiter",
      "documentationNote": null,
      "contactAttempts": 0,
      "contactMethods": 0,
      "updatedAt": "2026-10-16T00:35:42.070385Z"
    },
    {
      "id": "76763f3c-a951-465b-a0f2-eb7e0390336b",
      "studentUserId": "da089b1b-cc73-4cee-ae09-0c7b1eb9697e",
      "studentName": "Student 6",
      "studentEmail": "s6@lakeside.example",
      "enrollmentStatus": "Graduated",
      "graduationDate": "2025-03-31",
      "intent": "SelfEnrichment",
      "authorizedStudyCountry": true,
      "authorizedSearchCountry": true,
      "intentRecordedAt": "2026-10-16T00:35:42.079378Z",
      "hiredBySchool": false,
      "outcomeCategory": null,
      "effectiveCategory": "Excluded",
      "offerOrStartDate": null,
      "paid": null,
      "inField": null,
      "baseSalary": null,
      "employerName": null,
      "jobTitle": null,
      "socCode": null,
      "documentationSource": null,
      "documentationNote": null,
      "contactAttempts": 0,
      "contactMethods": 0,
      "updatedAt": "2026-10-16T00:35:42.07938Z"
    },
    {
      "id": "b2802df2-d5a5-40d9-8ae5-0de994039c30",
      "studentUserId": "2f8c47e9-1b14-43d0-9637-929a36174b61",
      "studentName": "Student 7",
      "studentEmail": "s7@lakeside.example",
      "enrollmentStatus": "Graduated",
      "graduationDate": "2025-03-31",
      "intent": "NewInFieldJob",
      "authorizedStudyCountry": true,
      "authorizedSearchCountry": true,
      "intentRecordedAt": "2026-10-06T00:35:42.177596Z",
      "hiredBySchool": false,
      "outcomeCategory": "1A",
      "effectiveCategory": "1A",
      "offerOrStartDate": "2025-05-10",
      "paid": true,
      "inField": null,
      "baseSalary": null,
      "employerName": "Datafy",
      "jobTitle": "Junior developer",
      "socCode": null,
      "documentationSource": "Employer",
      "documentationNote": "From the employer-verified outcome record (AtsWebhook). Confirm hours, contract length, in-field status and base salary.",
      "contactAttempts": 0,
      "contactMethods": 0,
      "updatedAt": "2026-10-16T00:35:42.342919Z"
    },
    {
      "id": "b27806e9-96c7-4421-b6d1-a012289efe18",
      "studentUserId": "d06cccec-2c81-48a6-823e-5eb294542c4d",
      "studentName": "Student 8",
      "studentEmail": "s8@lakeside.example",
      "enrollmentStatus": "Withdrew",
      "graduationDate": null,
      "intent": null,
      "authorizedStudyCountry": null,
      "authorizedSearchCountry": null,
      "intentRecordedAt": null,
      "hiredBySchool": false,
      "outcomeCategory": null,
      "effectiveCategory": null,
      "offerOrStartDate": null,
      "paid": null,
      "inField": null,
      "baseSalary": null,
      "employerName": null,
      "jobTitle": null,
      "socCode": null,
      "documentationSource": null,
      "documentationNote": null,
      "contactAttempts": 0,
      "contactMethods": 0,
      "updatedAt": "2026-10-16T00:35:42.100708Z"
    }
  ],
  "challenges": []
};
const challengeOptions = [
  {
    "id": "4c07c998-abf0-49d7-b088-fdc304f31d82",
    "title": "Build a REST API",
    "status": "Published",
    "closesAt": "2026-11-05T00:35:42.500538Z",
    "linked": false
  }
];
const cirrReport = {
  "label": "CIRR-style",
  "filters": {
    "cohortId": "bdd3cddb-ed67-4f8c-b1f2-5ef6ff562246",
    "year": null,
    "cohorts": [
      {
        "id": "bdd3cddb-ed67-4f8c-b1f2-5ef6ff562246",
        "name": "Winter 2025",
        "startDate": "2025-01-06"
      }
    ]
  },
  "minCellSize": 10,
  "totals": {
    "enrolled": 6,
    "graduates": 5,
    "onTime": 4,
    "counted": 4,
    "intentMissing": 0,
    "notCounted": 1
  },
  "tables": [
    {
      "key": "summary",
      "title": "Enrollment, graduation and placement by cohort",
      "columns": [
        "Cohort",
        "Enrolled",
        "Graduated on time",
        "On-time graduation rate",
        "Graduated late",
        "Graduation rate (all)",
        "Withdrew",
        "Still enrolled",
        "Graduates counted (not excluded)",
        "In-field job within 90 days",
        "In-field job within 180 days",
        "In-field job within 360 days",
        "In-field rate (360 days)",
        "Median base salary (in-field)",
        "Graduates reporting salary"
      ],
      "rows": [
        [
          "Winter 2025",
          6,
          4,
          "66.7%",
          1,
          "83.3%",
          1,
          0,
          4,
          3,
          4,
          4,
          "100.0%",
          "<10",
          "2 of 5 (40.0%)"
        ]
      ],
      "note": "Median salaries are hidden when fewer than 10 graduates reported one. In-field jobs are outcomes 1A-1C; rates use graduates who are not Excluded."
    },
    {
      "key": "categories",
      "title": "Graduate outcomes by CIRR category",
      "columns": [
        "Outcome",
        "Graduates",
        "Share of graduates"
      ],
      "rows": [
        [
          "1A Full-time employee",
          2,
          "40.0%"
        ],
        [
          "1B Full-time apprenticeship, internship, or contract position",
          1,
          "20.0%"
        ],
        [
          "1C Short-term contract, part-time position, freelance, or unknown length",
          1,
          "20.0%"
        ],
        [
          "1D Started a new company or venture after graduation",
          0,
          "0.0%"
        ],
        [
          "2A Employed out-of-field",
          0,
          "0.0%"
        ],
        [
          "2B Continuing to higher education",
          0,
          "0.0%"
        ],
        [
          "2C Not seeking a job for health, family, or personal reasons",
          0,
          "0.0%"
        ],
        [
          "3 Still seeking a job in-field",
          0,
          "0.0%"
        ],
        [
          "4 Could not contact",
          0,
          "0.0%"
        ],
        [
          "Excluded Excluded",
          1,
          "20.0%"
        ]
      ],
      "note": null
    },
    {
      "key": "windows",
      "title": "Placement within 90, 180 and 360 days",
      "columns": [
        "Window",
        "In-field job (1A-1C)",
        "In-field rate",
        "Any job (1A-1C, 2A)",
        "Any-job rate"
      ],
      "rows": [
        [
          "Within 90 days of graduation",
          3,
          "75.0%",
          3,
          "75.0%"
        ],
        [
          "Within 180 days of graduation",
          4,
          "100.0%",
          4,
          "100.0%"
        ],
        [
          "Within 360 days of graduation",
          4,
          "100.0%",
          4,
          "100.0%"
        ]
      ],
      "note": "Current CIRR standards use a 360-day window; the 90- and 180-day figures are extra views, not part of the current standard."
    },
    {
      "key": "jobCategories",
      "title": "Jobs by occupation group (2018 SOC major group)",
      "columns": [
        "Occupation group",
        "Graduates",
        "Share of jobs"
      ],
      "rows": [
        [
          "Computer and Mathematical",
          2,
          "50.0%"
        ],
        [
          "Arts, Design, Entertainment, Sports, and Media",
          1,
          "25.0%"
        ],
        [
          "Not classified",
          1,
          "25.0%"
        ]
      ],
      "note": "Jobs are outcomes 1A, 1B, 1C and 2A. Add a SOC code to each job to classify it."
    }
  ],
  "notes": [
    "Enrolled students are those enrolled on the school's full-refund deadline; students who died, became seriously ill or incarcerated, or were called to active duty are not counted.",
    "Graduates without a recorded outcome are Excluded when their first-day intent was not a new in-field job (or they are not authorized to work), and \"Still seeking\" otherwise.",
    "Every graduate has a first-day intent recorded.",
    "Salary is annual base compensation only. Any public salary figure must state the share of graduates who reported a salary.",
    "CIRR-style working report. Official CIRR reports are produced in the CIRR Outcomes Report Template spreadsheet, audited by a CIRR-approved auditor and published by CIRR. This report is not a CIRR report and does not show CIRR membership."
  ],
  "verifyFormat": "CIRR-style working report. Official CIRR reports are produced in the CIRR Outcomes Report Template spreadsheet, audited by a CIRR-approved auditor and published by CIRR. This report is not a CIRR report and does not show CIRR membership."
};
const sponsorView = {
  "kind": "WageIncrease",
  "expiresAt": "2026-11-05T06:44:13.874Z",
  "statement": "Registered apprenticeship: Electrician (0159). Apprentice: Student 0. Sponsor: Acme Robotics. Registration number: RA-TX-2026-001.\n\nAs the sponsor's representative, I confirm a wage increase to 20.00 per hour (wage schedule step 2), effective 2026-10-16, consistent with the skill acquired.",
  "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "proposedRate": 20,
  "proposedStep": 2,
  "staffNote": "Step 2 is due under the registered standards.",
  "school": {
    "displayName": "Lakeside State University",
    "slug": "lakeside"
  },
  "apprenticeship": {
    "studentName": "Student 0",
    "occupation": "Electrician",
    "occupationCode": "0159",
    "registrationNumber": "RA-TX-2026-001",
    "sponsorName": "Acme Robotics",
    "sponsorContactName": "Sam Supervisor",
    "startDate": "2026-01-05",
    "expectedEndDate": "2028-01-05",
    "ojlHoursRequired": 1500,
    "rtiHoursRequired": 288,
    "ojlHours": 1080,
    "rtiHours": 6,
    "currentRate": 18
  }
};

export const workforceFixtures: ApiFixture[] = [
  { path: "/api/career/workforce/wioa/definitions", body: wioaDefinitions },
  { path: "/api/career/workforce/wioa/report", body: wioaReport },
  { path: "/api/career/workforce/wioa/participants", body: participants },
  { path: /^\/api\/career\/workforce\/wioa\/participants\/[0-9a-f-]{36}$/, body: participant },
  { path: "/api/career/workforce/credentials", body: credentials },
  { path: /^\/api\/career\/workforce\/credentials\/[0-9a-f-]{36}\/awards$/, body: awards },
  { path: "/api/career/workforce/apprenticeships", body: apprenticeships },
  { path: "/api/career/workforce/apprenticeships/mine", body: myApprenticeships },
  { path: /^\/api\/career\/workforce\/apprenticeships\/[0-9a-f-]{36}$/, body: apprenticeship },
  { path: "/api/career/workforce/credentials/mine", body: myCredentials },
  { path: "/api/career/workforce/cirr/definitions", body: cirrDefinitions },
  { path: "/api/career/workforce/cohorts", body: cohorts },
  { path: /^\/api\/career\/workforce\/cohorts\/[0-9a-f-]{36}$/, body: cohort },
  { path: /^\/api\/career\/workforce\/cohorts\/[0-9a-f-]{36}\/challenge-options$/, body: challengeOptions },
  { path: "/api/career/workforce/cirr/report", body: cirrReport },
  { path: /^\/api\/career\/workforce\/sponsor\/[^/]+$/, body: sponsorView },
];

export const workforceRoutes: A11yRoute[] = [
  { name: "cc-reports-workforce", path: "/career-center/reports/workforce", persona: "career-center" },
  { name: "cc-reports-workforce-participant", path: "/career-center/reports/workforce#participants/45f5bc99-3d1d-41f2-9d42-6d144ab9c6fd", persona: "career-center" },
  { name: "cc-reports-workforce-credentials", path: "/career-center/reports/workforce#credentials", persona: "career-center" },
  { name: "cc-apprenticeships", path: "/career-center/apprenticeships", persona: "career-center" },
  { name: "cc-apprenticeship-detail", path: "/career-center/apprenticeships#d85e0423-b8b3-4043-a4df-6734e77c07cd", persona: "career-center" },
  { name: "cc-reports-cirr", path: "/career-center/reports/cirr", persona: "career-center" },
  { name: "cc-reports-cirr-cohort", path: "/career-center/reports/cirr#bdd3cddb-ed67-4f8c-b1f2-5ef6ff562246", persona: "career-center" },
  { name: "supervisor-apprenticeship", path: "/supervisor/apprenticeship/a11y-token.sig", persona: "public" },
];
