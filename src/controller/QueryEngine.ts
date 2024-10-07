import { type } from "os";
import { InsightDataset, InsightDatasetKind, InsightError, InsightResult } from "./IInsightFacade";
import { rejects } from "assert";
import Section from "../model/Section";
import SectionsDataset from "../model/SectionsDataset";
import { filter } from "jszip";

export default class QueryEngine {
	public isValidQuery(query: unknown, datasetMap: Map<string, InsightDataset>): boolean {
		// Check if query is of type Object, Reject with InsightError if not
		if (typeof query !== "object" || query === null) {
			return false;
		}

		const stringified = JSON.stringify(query);
		const parsedQuery = JSON.parse(stringified);
		const topLevelKeys = Object.keys(parsedQuery);

		// Check if only WHERE and OPTIONS exists in topLevelKeys
		if (!topLevelKeys.includes("WHERE") || !topLevelKeys.includes("OPTIONS") || topLevelKeys.length != 2) {
			return false;
		}

		// TODO:check for columns

		// try {
		// 	const filteredSection = this.handleWHERE(parsedQuery.WHERE, datasetMap);
		// 	const InsightResultList = [];
		// 	for (const section of filteredSection) {
		// 		InsightResultList.push({ sections_dept: section["dept"], sections_avg: section["avg"] });
		// 	}
		// 	return resolve(InsightResultList);
		// } catch (error) {
		// 	return reject(error);
		// }

		// // Check if all keys reference only one dataset

		// // Check if all keys and fields are valid

		// // AFTER RESULTS HAS BEEN PROCESSED: If the result is greater than 5000, Reject with ResultTooLarge error
		// return resolve([{ id: 1, name: "test" }]);
		return true;
	}

	// basically handling Filter
	private handleWHERE(queryWHERE: unknown, datasetMap: Map<string, InsightDataset>): Section[] {
		if (typeof queryWHERE !== "object" || queryWHERE === null) {
			throw new InsightError("WHERE must be an object");
		}
		const topLevelKeys = Object.keys(queryWHERE);
		// If WHERE is empty, return all entries
		// if (topLevelKeys.length === 0) {
		// 	return datasetMap.values();
		// }
		if (topLevelKeys.length !== 1) {
			throw new InsightError("WHERE must have ONE FILTER");
		}

		const filter = topLevelKeys[0];

		// IF WHERE has FILTER, pass on current entries to the filter helper
		if (filter == "AND" || filter == "OR") {
			console.log("logic");
		} else if (filter == "GT" || filter == "LT" || filter == "EQ") {
			return this.handleMComparison(queryWHERE, datasetMap);
		} else if (filter == "IS") {
			console.log("SCOMPARISION");
		} else if (filter == "NOT") {
			console.log("NEGATIOn");
		}

		throw new InsightError("filter is NOT valid");
	}

	// private handleOPTIONS() {}

	// Operation Functions

	// private handleLogic(queryLOGIC: unknown, datasetMap: Map<string, InsightDataset>): Map<string, InsightDataset> {}

	private handleMComparison(queryMComparator: unknown, datasetMap: Map<string, InsightDataset>): Section[] {
		// need this check to call Object.keys
		if (typeof queryMComparator !== "object" || queryMComparator === null) {
			throw new InsightError("MComparator must be an object");
		}
		// get the Mcomparator
		const McomparatorAsList = Object.keys(queryMComparator);
		const Mcomparator = McomparatorAsList[0];

		// assign the correct type to tell Typescript that its a key:value type
		const comparatorObj = queryMComparator as Record<string, string | number>;
		// get the mkey:number object
		const McomparatorValue = comparatorObj[Mcomparator];

		// get the Mkey
		const MkeyAsList = Object.keys(McomparatorValue);
		const Mkey = MkeyAsList[0];
		// if Mkey is not a string OR not a valid Mkey, throw InsightError
		if (typeof Mkey !== "string" || !this.getValidMkey(Mkey)) {
			throw new InsightError("not a valid Mkey");
		}

		if (typeof McomparatorValue !== "object" || McomparatorValue === null) {
			throw new InsightError("McomparatorValue must be an object with a valid Mkey");
		}

		const McomparatorValueObj = McomparatorValue as Record<string, number>;
		const MkeyValue = McomparatorValueObj[Mkey];
		const filterSections = this.handleMComparisonFiltering(Mcomparator, Mkey, MkeyValue, datasetMap);

		return filterSections;
	}

	private handleMComparisonFiltering(
		Mcomparator: String,
		Mkey: string,
		MkeyValue: number,
		datasetMap: Map<string, InsightDataset>
	): Section[] {
		const id: string = this.getID(Mkey);
		const ds = datasetMap.get(id);
		const fdsa = ds as SectionsDataset;
		console.log(fdsa.sections);
		const listOfSection = fdsa.sections;
		if (!ds) {
			console.log(`Dataset with ID ${id} not found.`);
		}

		const filteredSections: Section[] = [];
		for (const section of listOfSection) {
			// const sectionValue = section as Section;
			// const sectionKeyValue = sectionValue[Mkey];
			// console.log(sectionValue["Section"]);

			const MkeyField = this.getValidMkey(Mkey);
			if (MkeyField == "") {
				throw new InsightError("Invalid Mkey");
			}

			const sectionValue = section[MkeyField];

			switch (Mcomparator) {
				case "EQ": {
					if (sectionValue == MkeyValue) {
						filteredSections.push(section);
					}
				}
				case "GT": {
					if (sectionValue > MkeyValue) {
						filteredSections.push(section);
					}
				}
				// case "LT":
				// 	return sectionValue < MkeyValue;
				default:
					console.error(`Invalid comparator: ${Mcomparator}`);
				// return false;
			}
		}
		return filteredSections;
	}

	// private handleSComparison(querySComparator: unknown, datasetMap: Map<string, InsightDataset>): Map<string, InsightDataset> {}

	// private handleNegation(queryNegation: unknown, datasetMap: Map<string, InsightDataset>): Map<string, InsightDataset> {}

	// Validity Functions

	private isValidWildCard(wildcard: String) {
		for (let i = 1; i < wildcard.length - 1; i++) {
			const char: string = wildcard[i];
			if (char == "*") {
				return false;
			}
		}
		return true;
	}

	private getValidMkey(Mkey: String) {
		let underscoreIndex = 0;
		for (let i = 0; i < Mkey.length; i++) {
			const char: string = Mkey[i];
			if (char == "_") {
				underscoreIndex = i;
				break;
			}
		}
		const mkey = Mkey.substring(underscoreIndex + 1);
		if (mkey == "avg" || mkey == "pass" || mkey == "fail" || mkey == "audit" || mkey == "year") {
			return mkey;
		}
		return "";
	}

	private getValidSkey(Skey: String) {
		let underscoreIndex = 0;
		for (let i = 0; i < Skey.length; i++) {
			const char: string = Skey[i];
			if (char == "_") {
				underscoreIndex = i;
				break;
			}
		}
		const skey = Skey.substring(underscoreIndex + 1);
		if (skey == "dept" || skey == "id" || skey == "instructor" || skey == "title" || skey == "uuid") {
			return skey;
		}
		return "";
	}

	private getID(key: String) {
		let underscoreIndex = 0;
		for (let i = 0; i < key.length; i++) {
			const char: string = key[i];
			if (char == "_") {
				underscoreIndex = i;
				break;
			}
		}
		return key.substring(0, underscoreIndex);
	}
}
