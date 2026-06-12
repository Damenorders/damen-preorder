# Damen Preorder Website — Final MVP Specification

## 1. Main Goal

Build a custom internal preorder website for Damen Service Alimentaire.

The system should work like **one universal online sheet with restricted access**, not separate disconnected forms.

All users work from the same central database. When a rep, buyer, or admin adds, edits, or updates something, the change is reflected across all accounts based on their permission level.

The system must be:

* Clean looking
* Fast to use
* Mobile-friendly
* Easy for reps
* Specific and structured for buyers
* Odoo-compatible for future integration

---

# 2. Main Order Sections

The website will have 3 main order sections:

```text
Meat Orders
Fish Orders
Other Preorders
```

For MVP, all 3 sections should use the same layout style as the Fish Orders form.

The exact form inputs for Meat, Fish, and Other Preorders will be adjusted later.

---

# 3. User Roles

There are 3 access levels:

```text
Admin
Buyer
Rep
```

---

## 3.1 Admin Users

```text
Name: Orders
Email: orders@damenalimentaire.com
Role: Admin (primary admin; also the account owner for all infrastructure)
```

```text
Name: Vinny
Email: vincent@damenalimentaire.com
Role: Admin
```

Admin access:

* Full access to everything
* Fill forms
* Edit all forms
* View all submissions
* View all buyer tables
* Manage users
* Manage clients
* Manage products
* Export data
* Prepare Odoo compatibility
* Edit statuses
* View audit history

---

## 3.2 Buyer User

```text
Name: David
Email: david@damenalimentaire.com
Role: Buyer
```

Buyer access:

* Fill forms
* Edit all forms
* View all submissions
* View buyer tables
* Filter and sort all orders
* Change buyer table statuses
* View/edit Ready submission status
* Export data
* View all reps
* View all clients
* Access grouped buying sheets

Buyer does not manage admin-level settings unless granted later.

---

## 3.3 Rep User

```text
Name: Commandes
Email: commandes@damenalimentaire.com
Role: Rep
```

Rep access:

* Fill forms
* Edit only their own submissions
* View submissions
* Cannot access buyer table
* Cannot see buyer-only actions
* Cannot see buyer workflow statuses
* Cannot export full company data
* Cannot manage users, clients, or products

Important:

The rep can view the submissions page, but the rep does **not** see the same page as the buyer table.

The rep submissions view is simpler and more compact.

---

# 4. Login System

Users log in with their email.

After login, the system checks their role:

```text
Admin → Admin Dashboard
Buyer → Buyer Dashboard
Rep → Rep Dashboard
```

All access is controlled by role.

---

# 5. Rep Dashboard

The rep dashboard should be very simple.

The rep first sees the 3 order sections:

```text
Meat Orders
Fish Orders
Other Preorders
```

Inside each section, the rep sees:

```text
Fill Form
Edit Form
Submissions
```

Rep dashboard goal:

* Fast
* Simple
* Not crowded
* Easy to use on phone

---

# 6. Buyer Dashboard

The buyer dashboard has everything the rep has, plus buyer tools.

Buyer dashboard should include:

```text
Meat Orders
Fish Orders
Other Preorders
All Submissions
Buyer Tables
Grouped Buying Sheets
Exports
```

Buyer dashboard goal:

* Clean control center
* Fast filtering
* Easy order review
* Easy status management
* Easy export for Odoo and buying

---

# 7. Dynamic Form Logic

The form should never show 100 questions at once.

The form must work like this:

```text
Choose Page / Department
↓
Choose Product
↓
Only that product's questions appear
↓
Add product to order
↓
Submit
```

Example:

```text
Choose Salmon
↓
Only Salmon questions appear
```

Example:

```text
Choose Loup de Mer
↓
Only Loup de Mer questions appear
```

This applies to:

```text
Meat Orders
Fish Orders
Other Preorders
```

For MVP, use the same dynamic form layout for all 3 pages. Inputs will be adjusted later.

---

# 8. Fish Form Example

## If rep chooses Salmon

Show only:

```text
Quantity: 1-20
Size: 8/10, 10/12, 12/14
Skin: On / Off
Bone: On / Off
Clean: Simple / Deep
Head & Skin: Yes / No
Weight: Input number
Notes: Optional
```

## If rep chooses Loup de Mer

Show only:

```text
Quantity: 1-20
Format: Whole / Fillet
Size: Small / Medium / Big
Head & Skin: Yes / No
Weight: Input number
Notes: Optional
```

The rep should not see Salmon questions when ordering Loup de Mer.

---

# 9. Form Layout

Each form should have this structure:

```text
Client Name
Delivery Date
Choose Product
Dynamic Product Questions
Quantity
Weight
Notes
Submit
```

The form should be mobile-first.

Use:

```text
Large buttons
Dropdowns
Search fields
Simple product cards
Minimal typing
Clean spacing
```

Avoid:

```text
Long forms
Tiny checkboxes
Too many columns
Crowded tables on mobile
Unnecessary questions
```

---

# 10. Order Structure

The system should store orders as:

```text
Order Header
Order Lines
```

## Order Header

```text
Order ID
Department: Meat / Fish / Other Preorders
Client Name
Delivery Date
Rep Name
Rep Email
Submission Status
Buyer Table Status
General Notes
Created Time
Updated Time
```

## Order Lines

```text
Order Line ID
Order ID
Product
Specs
Quantity
Weight
Line Notes
Created Time
Updated Time
```

One order can contain multiple products.

Example:

```text
Client: Sushi Taxi
Delivery Date: Friday
Rep: Commandes

Line 1: Salmon, 10/12, Skin On, Bone Off, Deep Clean, Qty 5, Weight 42 KG
Line 2: Loup de Mer, Whole, Medium, Head & Skin Yes, Qty 8, Weight 30 KG
```

---

# 11. Submission Statuses

Submissions page uses these statuses only:

```text
Pending
Ready
Shipped
```

Meaning:

```text
Pending = Rep submitted, not finalized yet
Ready = Buyer reviewed and approved
Shipped = Order has been shipped / fulfilled
```

Buyer has access to view and edit Ready status.

Rep sees submission status, but not buyer table workflow status.

---

# 12. Buyer Table Statuses

Buyer table uses these statuses only:

```text
Pending
Ordered
Received
Pending Delivery
Pending Pickup
```

Meaning:

```text
Pending = Needs buyer action
Ordered = Buyer placed order / product was ordered
Received = Product arrived
Pending Delivery = Waiting to be delivered to client
Pending Pickup = Waiting for pickup
```

These statuses are buyer/admin only.

Reps do not need to see what the buyer does.

---

# 13. Rep Submissions Page

Rep submissions should first be filtered by page/module:

```text
Meat Orders
Fish Orders
Other Preorders
```

After the rep opens one page, submissions should be organized by **submission date**.

Example flow:

```text
Rep Dashboard
↓
Submissions
↓
Choose Fish Orders
↓
View submissions sorted by submission date
```

The rep submissions page should be very compact and easy to read.

---

# 14. Buyer Submissions Page

Buyer submissions should have advanced filtering.

Buyer can filter by:

```text
Page / Module
Submission Date
Delivery Date
Client Name
Rep Name
Product
Status
Orders With Notes
Created Time
Updated Time
```

Example flow:

```text
Buyer Dashboard
↓
All Submissions
↓
Filter by Fish Orders
↓
Filter by Delivery Date / Rep / Client / Product / Status
```

Buyer should be able to filter submissions many different ways.

---

# 15. Submissions Page Layout

The submissions page should show information in a compact, clean layout.

Recommended compact row:

```text
Client Name | Delivery Date | Product | Qty | Weight | Status | Rep Name
```

When the user opens a row, show full details:

```text
Specs
Notes
Created Time
Updated Time
Full order history
```

Do not show every detail at once if it makes the page crowded.

---

# 16. Edit Form Page

## Rep Edit Rules

Rep can edit only their own submissions.

Recommended rule:

```text
Rep can edit only when submission status = Pending
```

If the order is Ready or Shipped, the rep should not freely edit it.

## Buyer Edit Rules

Buyer can edit all submissions.

## Admin Edit Rules

Admin can edit all submissions.

---

# 17. Buyer Table Page

The buyer table is buyer/admin only.

Reps do not see this table.

Buyer table columns should include only:

```text
Client Name
Status
Delivery Date
Product
Specs
Quantity
Weight
Notes
Created Time
Updated Time
Rep Name
```

Important:

* Keep it compact.
* Do not add too many columns.
* Product details should be grouped into the Specs column.
* Notes should be visible but not make the table crowded.
* Buyer actions should be clean and easy to access.

Example Specs format:

```text
10/12 · Skin On · Bone Off · Deep Clean · Head & Skin Yes
```

---

# 18. Buyer Table Filters

Buyer table should have filters for:

```text
Status
Delivery Date
Product
Client Name
Rep Name
Created Time
Updated Time
Orders With Notes
```

Default buyer table view should be:

```text
Status: Pending
Delivery Date: Today / Tomorrow
```

The goal is for the buyer to immediately see what needs action.

---

# 19. Buyer Table Dynamic Sorting

The buyer table should automatically organize orders by:

```text
1. Delivery Date
2. Status Priority
3. Updated Time
```

Status priority should be:

```text
Pending
Ordered
Pending Delivery
Pending Pickup
Received
```

Important rule:

```text
Received orders always go to the bottom.
Ordered stays above Received.
Pending stays at the top.
```

When the buyer applies any filter, the table should still keep this order:

```text
Pending first
Ordered next
Pending Delivery / Pending Pickup next
Received last
```

Example:

```text
Delivery Date: Friday

Pending
- Order A
- Order B

Ordered
- Order C

Pending Delivery
- Order D

Pending Pickup
- Order E

Received
- Order F
- Order G
```

This keeps completed orders visible but out of the way.

---

# 20. Grouped Buying Sheet

The buyer should have a grouped buying sheet.

This groups orders by:

```text
Delivery Date
Product
Specs
Quantity
Weight
```

Example:

```text
SALMON 10/12 · SKIN ON · BONE OFF · DEEP CLEAN
Total Quantity: 18
Total Weight: 148 KG
Clients: 6
```

This is important because the buyer should not have to manually add product totals.

Grouped buying sheet should be buyer/admin only.

---

# 21. Export Requirements

The system should eventually support:

```text
CSV
Excel
PDF
```

Priority order:

```text
1. CSV
2. Excel
3. PDF
```

## CSV

Best for Odoo compatibility.

Use CSV for:

```text
Odoo import
System compatibility
Clean structured data transfer
```

## Excel

Best for buyer use.

Use Excel for:

```text
Buyer review
Internal editing
Supplier sheets
Daily buying sheets
```

## PDF

Best for printing.

Use PDF for:

```text
Supplier copy
Warehouse copy
Printed order sheet
```

Important:

PDF is not the main Odoo format. CSV is the priority for Odoo.

---

# 22. Odoo Compatibility

The system must be built Odoo-ready from day one.

Every important record should include:

```text
external_id
odoo_id
odoo_sync_status
last_synced_at
```

Use your own stable external IDs.

Example:

```text
damen_order_000001
damen_order_line_000001
damen_client_000001
damen_product_salmon_001
```

These IDs will help avoid duplicates when syncing or importing into Odoo later.

---

# 23. Odoo Mapping

The system should be structured to map cleanly to Odoo later.

```text
Client → res.partner
Rep / Buyer / Admin → res.users
Product → product.product
Product Category → product.category
Order Header → sale.order or custom order request
Order Lines → sale.order.line
Buyer Purchase Batch → purchase.order
Buyer Purchase Lines → purchase.order.line
Quantity Unit → uom.uom
```

The custom app should not be rebuilt when Odoo starts. It should only need an import/sync layer.

---

# 24. Database Tables

Minimum database tables:

```text
users
clients
products
orders
order_lines
audit_logs
```

## users

```text
id
external_id
odoo_id
name
email
role
active
created_at
updated_at
```

## clients

```text
id
external_id
odoo_id
client_name
active
created_at
updated_at
```

## products

```text
id
external_id
odoo_id
department
product_name
product_type
active
created_at
updated_at
```

## orders

```text
id
external_id
odoo_id
department
client_name
client_external_id
delivery_date
rep_user_id
rep_name
rep_email
submission_status
buyer_table_status
notes
created_at
updated_at
odoo_sync_status
last_synced_at
```

## order_lines

```text
id
external_id
odoo_id
order_id
department
product
specs
specs_json
quantity
weight
notes
created_at
updated_at
odoo_sync_status
last_synced_at
```

## audit_logs

```text
id
user_id
user_name
action
record_type
record_id
old_value
new_value
created_at
```

---

# 25. Specs Storage

Product specs should be stored in two ways:

## 1. Readable Specs

For the buyer table:

```text
10/12 · Skin On · Bone Off · Deep Clean · Head & Skin Yes
```

## 2. Structured Specs JSON

For future filtering, reporting, and Odoo compatibility:

```json
{
  "size": "10/12",
  "skin": "On",
  "bone": "Off",
  "clean": "Deep",
  "headAndSkin": "Yes"
}
```

This is important because forms are dynamic.

---

# 26. Sync Logic

Everything should update from one central database.

Example:

```text
Rep submits order
↓
Buyer sees it
↓
Buyer changes status
↓
Rep sees updated submission status
```

Example:

```text
Buyer edits quantity
↓
Submission updates
↓
Buyer table updates
↓
Grouped buying sheet updates
```

The website should behave like one universal sheet with role-based restrictions.

---

# 27. Audit History

The system should track important changes.

Track:

```text
Who changed it
What changed
Old value
New value
Date and time
```

This is important for:

```text
Quantity changes
Weight changes
Delivery date changes
Product changes
Status changes
Notes changes
```

---

# 28. Clean Design Requirements

The design must be:

```text
Clean
Smooth
Seamless
Modern
Not crowded
Easy to read
Fast on phone
```

Use:

```text
White background
Soft grey borders
Rounded cards
Large buttons
Compact filters
Simple icons
One accent color
Good spacing
```

Avoid:

```text
Crowded tables
Tiny text
Too many colors
Too many columns
Long forms
Spreadsheet feel on mobile
```

---

# 29. MVP Build Order

Build in this order:

```text
1. Confirm 3 sections: Meat Orders, Fish Orders, Other Preorders
2. Create users and roles
3. Build login system
4. Build role-based access control
5. Build rep dashboard
6. Build buyer dashboard
7. Build admin access
8. Build universal order database
9. Build dynamic form layout
10. Apply same form layout to all 3 sections
11. Build submissions page
12. Build edit form page
13. Build buyer table page
14. Add submission statuses: Pending, Ready, Shipped
15. Add buyer table statuses: Pending, Ordered, Received, Pending Delivery, Pending Pickup
16. Add buyer table filters
17. Add dynamic delivery-date/status sorting
18. Build grouped buying sheet
19. Add CSV export for Odoo
20. Add Excel export for buyer use
21. Add PDF export for printing
22. Add Odoo-ready fields
23. Add audit history
24. Test full workflow
25. Launch MVP
26. Improve after launch
```

---

# 30. MVP Launch Features

The first launch should include only the essentials:

```text
Login
Role-based access
Admin / Buyer / Rep permissions
Three order sections
Dynamic forms
Fill form
Edit form
Submissions page
Buyer table
Filters
Statuses
CSV export
Odoo-ready fields
Audit logs
```

Do not overbuild version 1.

---

# 31. Later Improvements

After the MVP works, add:

```text
Excel export
PDF export
Grouped buying sheet improvements
Client dropdown
Product dropdown
Supplier purchase order creation
Odoo API sync
Notifications
Mobile app shortcut
Saved favorite orders
Copy previous order
```

---

# 32. Final System Summary

The final system should be:

```text
One universal preorder system
Three modules: Meat, Fish, Other Preorders
One shared database
Role-based access
Rep dashboard
Buyer dashboard
Admin access
Dynamic product forms
Compact submissions page
Buyer-only table
Buyer-only statuses
Grouped buying sheets
CSV-first Odoo compatibility
Future Odoo sync ready
```

The main rule:

```text
Reps enter orders fast.
Buyers receive clean structured data.
Admins control the system.
Everything stays synced through one central database.
The system is built for Odoo compatibility from day one.
```
