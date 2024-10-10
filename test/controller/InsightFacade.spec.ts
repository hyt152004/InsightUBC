import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError,
} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";
import { clearDisk, getContentFromArchives, loadTestQuery } from "../TestUtil";

import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);

export interface ITestQuery {
	title?: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}

describe("InsightFacade", function () {
	let facade: IInsightFacade;

	// Declare datasets used in tests. You should add more datasets like this!
	let sections: string;
	let emptySections: string;
	let wrongFolderName: string;
	let invalidSection: string;
	let oneValidCourse: string;
	let invalidKey: string;
	let missingField1: string;
	let missingField2: string;
	let emptyStringField: string;

	before(async function () {
		// This block runs once and loads the datasets.
		sections = await getContentFromArchives("pair.zip");
		emptySections = await getContentFromArchives("emptyDataset.zip");
		wrongFolderName = await getContentFromArchives("wrongFolderName.zip");
		invalidSection = await getContentFromArchives("invalidSection.zip");
		oneValidCourse = await getContentFromArchives("oneValidCourse.zip");
		invalidKey = await getContentFromArchives("invalidKey.zip");
		missingField1 = await getContentFromArchives("missingField1.zip");
		missingField2 = await getContentFromArchives("missingField2.zip");
		emptyStringField = await getContentFromArchives("emptyStringField.zip");

		// Just in case there is anything hanging around from a previous run of the test suite
		await clearDisk();
	});

	describe("AddDataset", function () {
		beforeEach(async function () {
			// This section resets the insightFacade instance
			// This runs before each test
			await clearDisk();
			facade = new InsightFacade();
		});

		afterEach(async function () {
			// This section resets the data directory (removing any cached data)
			// This runs after each test, which should make each test independent of the previous one
			await clearDisk();
		});

		it("should reject with an empty dataset id", async function () {
			try {
				await facade.addDataset("", oneValidCourse, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject id with whitespace", async function () {
			try {
				await facade.addDataset(" ", oneValidCourse, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject id with underscore", async function () {
			try {
				await facade.addDataset("_", oneValidCourse, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject duplicated id", async function () {
			try {
				await facade.addDataset("ubc", oneValidCourse, InsightDatasetKind.Sections);
				await facade.addDataset("ubc", oneValidCourse, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject empty dataset", async function () {
			try {
				await facade.addDataset("ubc", emptySections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject dataset with invalid folder name", async function () {
			try {
				await facade.addDataset("ubc", wrongFolderName, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject dataset with invalid section", async function () {
			try {
				await facade.addDataset("ubc", invalidSection, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject dataset with invalid key", async function () {
			try {
				await facade.addDataset("ubc", invalidKey, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject dataset with missing fields", async function () {
			try {
				await facade.addDataset("ubc", missingField2, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should successfully add a dataset with at least one valid section", async function () {
			const result = await facade.addDataset("ubc", oneValidCourse, InsightDatasetKind.Sections);
			expect(result).to.have.members(["ubc"]);
		});

		it("should successfully add a dataset with at least one valid section (with no missing field)", async function () {
			const result = await facade.addDataset("ubc", missingField1, InsightDatasetKind.Sections);
			expect(result).to.have.members(["ubc"]);
		});

		it("should successfully add a dataset with empty string fields", async function () {
			const result = await facade.addDataset("ubc", emptyStringField, InsightDatasetKind.Sections);
			expect(result).to.have.members(["ubc"]);
		});

		it("should successfully add a dataset (first)", async function () {
			const result = await facade.addDataset("ubc", oneValidCourse, InsightDatasetKind.Sections);
			expect(result).to.have.members(["ubc"]);
		});

		it("should successfully add a dataset (second)", async function () {
			const result = await facade.addDataset("ubc", oneValidCourse, InsightDatasetKind.Sections);
			expect(result).to.have.members(["ubc"]);
		});

		it("should successfully add two datasets", async function () {
			let result = await facade.addDataset("ubc", oneValidCourse, InsightDatasetKind.Sections);
			result = await facade.addDataset("ubcv", oneValidCourse, InsightDatasetKind.Sections);
			expect(result).to.have.members(["ubc", "ubcv"]);
		});
	});

	describe("RemoveDataset", function () {
		beforeEach(async function () {
			// This section resets the insightFacade instance
			// This runs before each test
			await clearDisk();
			facade = new InsightFacade();
		});

		afterEach(async function () {
			// This section resets the data directory (removing any cached data)
			// This runs after each test, which should make each test independent of the previous one
			await clearDisk();
		});

		it("should reject with an empty dataset id (remove)", async function () {
			try {
				await facade.removeDataset("");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject id with whitespace (remove)", async function () {
			try {
				await facade.removeDataset(" ");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject id with underscore (remove)", async function () {
			try {
				await facade.removeDataset("_");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject id not yet added", async function () {
			try {
				await facade.removeDataset("ubc");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(NotFoundError);
			}
		});

		it("should reject id that does not match any dataset", async function () {
			try {
				await facade.addDataset("ubc", oneValidCourse, InsightDatasetKind.Sections);
				await facade.removeDataset("ubcv");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(NotFoundError);
			}
		});

		it("should reject removed id", async function () {
			try {
				await facade.addDataset("ubc", oneValidCourse, InsightDatasetKind.Sections);
				await facade.removeDataset("ubc");
				await facade.removeDataset("ubc");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(NotFoundError);
			}
		});

		it("should successfully remove a dataset", async function () {
			await facade.addDataset("ubc", oneValidCourse, InsightDatasetKind.Sections);
			await facade.removeDataset("ubc");
			const remainingDatasets = await facade.listDatasets();
			expect(remainingDatasets.map((ds) => ds.id)).to.not.include("ubc");
		});
	});

	describe("ListDatasets", function () {
		beforeEach(async function () {
			// This section resets the insightFacade instance
			// This runs before each test
			await clearDisk();
			facade = new InsightFacade();
			await facade.addDataset("first", sections, InsightDatasetKind.Sections);
			await facade.addDataset("second", sections, InsightDatasetKind.Sections);
		});

		afterEach(async function () {
			// This section resets the data directory (removing any cached data)
			// This runs after each test, which should make each test independent of the previous one
			await clearDisk();
		});

		it("should successfully list all datasets", async function () {
			const expected: InsightDataset[] = [
				{ id: "first", kind: InsightDatasetKind.Sections, numRows: 64612 },
				{ id: "second", kind: InsightDatasetKind.Sections, numRows: 64612 },
			];
			const result = await facade.listDatasets();
			expect(result).to.deep.equal(expected);
		});
	});

	describe("PerformQuery", function () {
		/**
		 * Loads the TestQuery specified in the test name and asserts the behaviour of performQuery.
		 *
		 * Note: the 'this' parameter is automatically set by Mocha and contains information about the test.
		 */
		async function checkQuery(this: Mocha.Context): Promise<void> {
			if (!this.test) {
				throw new Error(
					"Invalid call to checkQuery." +
						"Usage: 'checkQuery' must be passed as the second parameter of Mocha's it(..) function." +
						"Do not invoke the function directly."
				);
			}
			// Destructuring assignment to reduce property accesses
			const { input, expected, errorExpected } = await loadTestQuery(this.test.title);
			let result: InsightResult[] | undefined;
			try {
				result = await facade.performQuery(input);
				if (errorExpected) {
					expect.fail(`performQuery resolved when it should have rejected with ${expected}`);
				}
				// return expect.fail("Write your assertion(s) here."); // TODO: replace with your assertions
				expect(result).to.deep.members(expected);
				// expect(result).to.deep.equal(expected);
			} catch (err) {
				if (!errorExpected) {
					expect.fail(`performQuery threw unexpected error: ${err}`);
				}
				// return expect.fail("Write your assertion(s) here."); // TODO: replace with your assertions
				if (expected === "ResultTooLargeError") {
					expect(err).to.be.instanceOf(ResultTooLargeError);
				} else {
					expect(err).to.be.instanceOf(InsightError);
				}
			}
		}

		before(async function () {
			facade = new InsightFacade();

			// Add the datasets to InsightFacade once.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises: Promise<string[]>[] = [
				facade.addDataset("sections", sections, InsightDatasetKind.Sections),
				facade.addDataset("one", oneValidCourse, InsightDatasetKind.Sections),
			];
			try {
				await Promise.all(loadDatasetPromises);
			} catch (err) {
				throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${err}`);
			}
		});

		after(async function () {
			await clearDisk();
		});

		// Examples demonstrating how to test performQuery using the JSON Test Queries.
		// The relative path to the query file must be given in square brackets.
		it("[valid/simple.json] SELECT dept, avg WHERE avg > 97", checkQuery);
		it("[valid/inputstring.json] SELECT inputstring", checkQuery);
		it("[valid/*inputstring.json] SELECT *inputstring", checkQuery);
		it("[valid/inputstring*.json] SELECT inputstring*", checkQuery);
		it("[valid/*inputstring*.json] SELECT *inputstring*", checkQuery);
		it("[valid/oneAsterisk.json] SELECT with one asterisk", checkQuery);
		it("[valid/twoAsterisks.json] SELECT with two asterisks", checkQuery);
		it("[valid/simpleNoOrder.json] SELECT dept, avg WHERE avg > 97, No Order", checkQuery);

		it("[valid/simpleOR.json] SELECT with OR", checkQuery);
		it("[valid/complex.json] SELECT with AND and OR", checkQuery);
		it("[valid/complexNegation.json] SELECT with AND and OR and NOT", checkQuery);
		it("[valid/noResult.json] Query with no result", checkQuery);
		it("[valid/doubleNegation.json] Query with double NOT", checkQuery);

		it("[valid/oneCourseQuery.json] SELECT dept, one course", checkQuery);
		it("[valid/oneCourseNoResult.json] No result, one course", checkQuery);
		it("[valid/oneCourseAll.json] SELECT all, one course", checkQuery);
		it("[valid/year1900.json] SELECT year = 1900", checkQuery);

		it("[invalid/invalid.json] Query missing WHERE", checkQuery); //
		it("[invalid/missingInput.json] Query missing WHERE and OPTION", checkQuery); //
		it("[invalid/twoFields.json] Query with two fields", checkQuery); //
		it("[invalid/resultTooLarge2.json] SELECT large result 2", checkQuery);
		it("[invalid/input*string.json] SELECT input*string", checkQuery); //
		it("[invalid/resultTooLarge.json] SELECT large result", checkQuery);
		it("[invalid/twoFilterKeys.json] Query WHERE with 2 keys", checkQuery); //
		it("[invalid/invalidId.json] Query invalid id", checkQuery);
		it("[invalid/invalidMKey.json] Query invalid mkey", checkQuery); //
		it("[invalid/invalidSKey.json] Query invalid skey", checkQuery); //
		it("[invalid/invalidMField.json] Query invalid mfield", checkQuery); //
		it("[invalid/invalidSField.json] Query invalid sfield", checkQuery); //
		it("[invalid/invalidMComparator.json] Query invalid mcomparator", checkQuery); //
		it("[invalid/invalidSComparator.json] Query invalid scomparator", checkQuery); //
		it("[invalid/missingOption.json] Query missing OPTION", checkQuery); //
		it("[invalid/missingColumn.json] Query missing COLUMN", checkQuery); //
		it("[invalid/invalidOrderKey.json] Query with invalid ORDER key", checkQuery); //
		it("[invalid/invalidColumnKey.json] Query with invalid COLUMN key", checkQuery); //
	});
});
