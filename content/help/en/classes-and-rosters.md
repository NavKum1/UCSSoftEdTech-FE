---
title: Create a class and import its roster
summary: Make a class, bring in its students from a spreadsheet, and add a co-teacher.
roles: [teacher, admin]
group: People and classes
features: [class-assessments]
order: 11
checked: 2026-11-11
---
## Create a class

1. Open [ui: Classes] and find [ui: New class].
2. Enter the [ui: Class name], for example "CS 341, Fall 2026". The program and graduation year are optional.
3. Select [ui: Create class]. You're the class's owner.

## Import the roster

On the class page, use [ui: Import roster]. Either choose a [ui: CSV file] or use [ui: Or paste the rows], then select [ui: Import].

The file needs a header row with these columns:

- `name` and `email` (required)
- `roll_number` and `branch` (optional)

For example:

`name,email,roll_number`

`Priya Raman,priya@college.edu,CS-101`

If any row has a problem, nothing is imported and each problem is listed with its row number, so you can fix the file and import again. Files can be up to 5 MB.

Students sign in with the e-mail address on the roster. The class shows who has signed in.

## Add a co-teacher

Under [ui: Add a co-teacher], pick a teacher at your school who has already signed in, and select [ui: Add teacher]. Co-teachers see the class's students and work, and can review and decide.

> To give the class an assessment, use [ui: Give this class an assessment] on the class page. See [Give an assessment to a class](/help/give-to-a-class).
