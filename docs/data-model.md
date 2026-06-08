# Data Model & Graph Structure

Notes on how the Excel dataset maps to CouchDB documents and becomes a 3D force-directed graph.

## Excel Files

Three Excel files form the dataset, linked by `projectid`:

| File                | Rows  | Key field   | Payload                                                       |
| ------------------- | ----- | ----------- | ------------------------------------------------------------- |
| `project.xlsx`      | ~500  | `projectid` | Project metadata (name, year, status, description, etc.)      |
| `organization.xlsx` | ~1000 | `projectid` | Organizations linked to projects (org name, role, etc.)       |
| `topics.xlsx`       | ~1000 | `projectid` | Topics/themes linked to projects (topic name, category, etc.) |

## CouchDB Document Structure

All documents stored in `graph_db` with a `type` field:

### Type: "project"

```json
{
  "_id": "project:12345",
  "type": "project",
  "projectid": "12345",
  "name": "Project Name",
  "year": 2023,
  "status": "active",
  "description": "...",
  "other_fields": "..."
}
```

### Type: "organization"

```json
{
  "_id": "organization:12345:acme",
  "type": "organization",
  "projectid": "12345",
  "name": "ACME Corp",
  "role": "partner",
  "other_fields": "..."
}
```

### Type: "topic"

```json
{
  "_id": "topic:12345:ai",
  "type": "topic",
  "projectid": "12345",
  "name": "Artificial Intelligence",
  "category": "technology",
  "other_fields": "..."
}
```

## Graph Nodes & Links

The force-directed graph is built from these documents:

### Nodes

- **Project node**: One per project. Visual properties: size (by project age/status), color (by status), label (project name).
- **Organization node**: One per unique organization (deduplicated across all projects linking to it). Color by organization type or role.
- **Topic node**: One per unique topic (deduplicated). Color by topic category.

### Links

- **Project ↔ Organization**: Drawn for each project-organization pair. Weight (link strength) can be adjusted at runtime.
- **Project ↔ Topic**: Drawn for each project-topic pair. Weight can be adjusted at runtime.
- **No direct Organization ↔ Topic links** by default (but could be added based on co-occurrence).

### Link Weight Strategy

At runtime, users can adjust link strength via sliders:

- "Project-Org weight" slider: scales all project→org link forces globally.
- "Project-Topic weight" slider: scales all project→topic link forces globally.
- This affects `distance` and `strength` parameters in the force simulation.

## Example Graph (simplified)

```
Project A ←→ Org 1
         ←→ Org 2
         ←→ Topic X
         ←→ Topic Y

Project B ←→ Org 2 (shared)
         ←→ Org 3
         ←→ Topic X (shared)
         ←→ Topic Z
```

In 3D: projects naturally cluster with organizations/topics they link to. Shared orgs/topics create bridges between project clusters.

## Node Deduplication

When importing:

- **Organizations**: aggregate by name (or a unique org ID if available in Excel). One CouchDB doc per org, but linked to multiple projects.
- **Topics**: aggregate by name (or unique topic ID). One CouchDB doc per topic, linked to multiple projects.

So if 100 projects link to "ACME Corp", there is only one `organization:acme` doc, but 100 `project→org` edges in the graph.

## Filtering Dimensions

The UI will offer filters based on:

- **Organization**: show/hide entire org nodes and their links.
- **Topic**: show/hide entire topic nodes and their links.
- **Year**: show only projects from selected years.
- **Project Status**: show only projects with selected statuses (active, completed, paused, etc.).

Applying filters removes nodes and their incident edges dynamically without recreating graph data structures.

## Future: Computed Nodes & Links

Once the basic structure works, we might add:

- **Cluster nodes**: virtual "hub" nodes representing a group (e.g., all projects from 2023). Clicking expands/collapses.
- **Weighted links**: store precomputed link weights based on shared attributes.

For now: raw edges, runtime-adjustable link strength.
