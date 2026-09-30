<!-- # CPSC 310 Project Repository

This repository contains starter code for the class project.
Please keep your repository private.

For information about the project, autotest, and the checkpoints, see the course webpage.

## Configuring your environment

To start using this project, you need to get your development environment configured so that you can build and execute the code.
To do this, follow these steps; the specifics of each step will vary based on your operating system:

1. [Install git](https://git-scm.com/downloads) (v2.X). You should be able to execute `git --version` on the command line after installation is complete.

1. [Install Node LTS](https://nodejs.org/en/download/) (LTS: v18.X), which will also install NPM (you should be able to execute `node --version` and `npm --version` on the command line).

1. [Install Yarn](https://yarnpkg.com/en/docs/install) (1.22.X). You should be able to execute `yarn --version`.

1. Clone your repository by running `git clone REPO_URL` from the command line. You can get the REPO_URL by clicking on the green button on your project repository page on GitHub. Note that due to new department changes you can no longer access private git resources using https and a username and password. You will need to use either [an access token](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line) or [SSH](https://help.github.com/en/github/authenticating-to-github/adding-a-new-ssh-key-to-your-github-account).

## Project commands

Once your environment is configured you need to further prepare the project's tooling and dependencies.
In the project folder:

1. `yarn install` to download the packages specified in your project's *package.json* to the *node_modules* directory.

1. `yarn build` to compile your project. You must run this command after making changes to your TypeScript files. If it does not build locally, AutoTest will not be able to build it. This will also run formatting and linting, so make sure to fix those errors too!

1. `yarn test` to run the test suite.
    - To run with coverage, run `yarn cover`

1. `yarn prettier:fix` to format your project code.

1. `yarn lint:check` to see lint errors in your project code. You may be able to fix some of them using the `yarn lint:fix` command.


If you are curious, some of these commands are actually shortcuts defined in [package.json -> scripts](./package.json).

## Running and testing from an IDE

IntelliJ Ultimate should be automatically configured the first time you open the project (IntelliJ Ultimate is a free download through the [JetBrains student program](https://www.jetbrains.com/community/education/#students/)).

### License

While the readings for this course are licensed using [CC-by-SA](https://creativecommons.org/licenses/by-sa/3.0/), **checkpoint descriptions and implementations are considered private materials**. Please do not post or share your project solutions. We go to considerable lengths to make the project an interesting and useful learning experience for this course. This is a great deal of work, and while future students may be tempted by your solutions, posting them does not do them any real favours. Please be considerate with these private materials and not pass them along to others, make your repos public, or post them to other sites online. -->



# InsightUBC

This project is basically my attempt at building a real-ish data query engine for UBC course and room information. The whole idea is that you upload a dataset, validate it, store it locally, and then run structured queries against it using a JSON-based query language that feels a bit like SQL, but in a much more annoying and very course-project-specific way.

The app is written in TypeScript and runs on Node 18. It has a REST API, a dataset processing layer, custom validation logic, and a query engine that supports filtering, grouping, aggregation, and sorting. It is the kind of project where every little edge case ends up making you question your life choices, but also teaches you a lot about backend architecture and data processing.

## What this project does

The system supports two main dataset types:

- Sections data: UBC course section records like course, department, professor, average, pass/fail counts, and year.
- Rooms data: UBC building and room metadata including room number, seats, furniture, location, and coordinates.

Once a dataset is uploaded, the app:

1. Validates the input and ID.
2. Parses the zip archive and extracts the relevant files.
3. Normalizes the records into a consistent internal structure.
4. Saves the resulting JSON to a local `data/` folder.
5. Allows future queries over the dataset using the custom query language.

This is a pretty standard “data processing pipeline” type project, but with a bunch of UBC-specific constraints layered on top.

## Tech stack

- TypeScript
- Node.js 18
- Express
- JSZip for ZIP parsing
- parse5 for HTML parsing
- fs-extra for disk operations
- decimal.js for numeric precision
- Mocha + Chai for tests
- ESLint + Prettier for style enforcement

The project is set up with a few scripts in `package.json`, which makes local development and validation easy enough if you actually remember the exact commands.

## High-level architecture

### 1. App bootstrap

The entry point is `src/App.ts`. This file creates a `Server` instance and starts it on port `4321`.

At a high level, the flow is:

- app starts
- server initializes Express middleware
- routes are registered
- app listens for network requests

It is intentionally minimal because most of the real logic lives in the facade and processing layers.

### 2. Server layer

The REST API is implemented in `src/rest/Server.ts`.

It exposes endpoints such as:

- `PUT /dataset/:id/:kind` to upload a dataset
- `DELETE /dataset/:id` to remove a dataset
- `POST /query` to run a query
- `GET /datasets` to list available datasets
- `GET /echo/:msg` as a tiny test endpoint

The server is mostly a thin wrapper around the business logic. It parses incoming JSON, calls the facade, catches errors, and returns HTTP status codes.

### 3. Facade layer

`src/controller/InsightFacade.ts` is the main orchestration point. This is where the app:

- validates dataset IDs
- prevents duplicate datasets
- checks whether a dataset already exists on disk
- reads JSON datasets back into memory
- delegates query execution to `QueryEngine`

It acts like the interface between the HTTP layer and the processing pipeline. In a project like this, the facade is where I ended up doing a lot of the “make sure this is consistent everywhere” logic.

### 4. Dataset processing

There are separate processors for each dataset type.

#### Section processing

`src/controller/SectionProcessor.ts` handles course section archives. It:

- loads the uploaded zip with JSZip
- checks for the expected `courses/` structure
- reads each course JSON file
- filters out invalid section records
- normalizes section entries and prefixes fields with the dataset id
- writes the final data to `./data/<id>.json`

This part is a bit brittle because it depends deeply on the original archive structure. If the dataset is malformed or missing required keys, the app either skips bad records or throws an error.

#### Room processing

`src/controller/RoomProcessor.ts` is more complicated than the section processor. It:

- reads the zip archive
- finds `index.htm`
- parses the HTML structure with `parse5`
- identifies relevant building tables
- follows each building link to its room listing page
- extracts room metadata
- resolves coordinates and address data
- builds room objects with prefixed fields like `room_fullname`, `room_shortname`, and `room_name`
- writes all valid rooms to disk

This part basically turns a messy HTML directory into a structured dataset. It is one of the more technically interesting parts of the project because it mixes DOM parsing, location data, and record normalization.

## Query system

The query engine is the real core of the project.

### Query validation

`src/controller/QueryValidator.ts` validates the user-provided query before anything is executed. It checks that:

- the query is a valid object
- `WHERE` and `OPTIONS` exist
- `COLUMNS` are defined correctly
- fields are valid for the dataset kind
- logic comparisons use valid syntax
- `GROUP` and `APPLY` transformations are structurally correct
- sort keys are valid
- wildcard strings are valid for string comparisons

This is where the project becomes very rules-heavy. The validator is not just checking that the JSON exists; it is validating the semantics of the query against the expected dataset schema. That is important because these queries have a very specific grammar and a lot of invalid combinations are possible.

### Query execution

`src/controller/QueryEngine.ts` actually executes queries over dataset objects. It supports:

- `WHERE` filtering
- nested logical filters with `AND` and `OR`
- `NOT` negation
- numeric comparisons with `GT`, `LT`, and `EQ`
- string comparisons with `IS` and wildcard matching
- sorting with `ORDER`
- grouping and apply transformations with `GROUP` and `APPLY`
- aggregation functions such as `MAX`, `MIN`, `AVG`, `SUM`, and `COUNT`

It also enforces a result-size ceiling of 5000 rows, which is a nice sanity check so the app does not blow up on giant queries.

## Data model

The project uses dataset objects defined in `src/model/Dataset.ts` and various typed model classes such as:

- `Section`
- `SectionsDataset`
- `Room`
- `RoomsDataset`

These models wrap the raw JSON data and add the dataset-specific prefixes needed for valid query keys. For example, section field names are prefixed with the dataset ID, and the query validator knows how to recognize those names.

That part is a little awkward from a design perspective, but it is effective for the course project because it keeps query keys unique and consistent when multiple datasets are loaded.

## File structure

```text
InsightUBC/
├── src/
│   ├── App.ts
│   ├── controller/
│   │   ├── IInsightFacade.ts
│   │   ├── InsightFacade.ts
│   │   ├── QueryEngine.ts
│   │   ├── QueryValidator.ts
│   │   ├── QueryValidatorHelper.ts
│   │   ├── RoomProcessor.ts
│   │   ├── RoomProcessorHelper.ts
│   │   └── SectionProcessor.ts
│   ├── model/
│   │   ├── Dataset.ts
│   │   ├── Room.ts
│   │   ├── RoomsDataset.ts
│   │   ├── Section.ts
│   │   └── SectionsDataset.ts
│   └── rest/
│       └── Server.ts
├── test/
│   ├── controller/
│   ├── resources/
│   └── rest/
├── frontend/
│   └── public/
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

## Getting started

If you want to run this locally:

```bash
yarn install
yarn start
```

The app defaults to port `4321`.

Useful project scripts:

```bash
yarn test
yarn build
yarn lint:check
yarn prettier:check
```

## Example query

Here is an example of the kind of JSON queries the system expects:

```json
{
  "WHERE": {
    "AND": [
      { "GT": { "sections_avg": 90 } },
      { "IS": { "sections_dept": "CPSC*" } }
    ]
  },
  "OPTIONS": {
    "COLUMNS": ["sections_dept", "sections_id", "sections_avg"],
    "ORDER": "sections_avg"
  }
}
```

This would filter for CPSC courses with an average above 90 and then return only the relevant fields in sorted order.

## Challenges and design notes

This project was a good example of how a small data application can become complicated very quickly. A lot of the challenge was not in the “big ideas,” but in the details:

- validating malformed JSON
- handling edge cases in raw dataset files
- supporting multiple dataset types without crashing
- keeping query semantics consistent
- making the API behave predictably under invalid inputs
- managing data persistence locally instead of in a database

A lot of the logic is custom and hand-written, which is exactly the kind of thing that makes CPSC 310 feel like a real software engineering project instead of just a class assignment.

## Final thoughts

At the end of the day, this project is basically a mini data warehouse with a custom query DSL, a parser, a validator, and a backend API. It is not the cleanest architecture ever written, but it is a solid project for learning how data-intensive systems work in practice.

I think the most important thing I learned from building it is that the hardest part is not handling the happy path. The hard part is dealing with invalid data, undocumented assumptions, and all the weird cases that appear when you start working with real-world datasets from messy university systems.

That is honestly what made it useful.

