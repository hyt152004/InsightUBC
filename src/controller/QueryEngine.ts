import { type } from "os";
import { InsightDataset, InsightDatasetKind, InsightError, InsightResult } from "./IInsightFacade";
import { rejects } from "assert";
import Section from "../model/Section";
import SectionsDataset from "../model/SectionsDataset";
import { filter } from "jszip";

export default class QueryEngine {
	public isValidQuery(query: unknown): boolean {
		// Check if query is of type Object, Reject with InsightError if not
		if (typeof query !== "object" || query === null) {
			return false;
		}

		const stringified = JSON.stringify(query);
		const parsedQuery = JSON.parse(stringified);
		const topLevelKeys = Object.keys(parsedQuery);

		// Check if only WHERE and OPTIONS exists in topLevelKeys
		if (!topLevelKeys.includes("WHERE") || !topLevelKeys.includes("OPTIONS") || topLevelKeys.length !== 2) {
			return false;
		}

		// Check if all keys and fields are valid inside WHERE
		if (!this.isValidWHERE(parsedQuery.WHERE)) {
			return false;
		}

		if (!this.isValidOPTIONS(parsedQuery.OPTIONS)) {
			return false;
		}

		// TODO: Check if all keys reference only one dataset

		// TODO: AFTER RESULTS HAS BEEN PROCESSED: If the result is greater than 5000, Reject with ResultTooLarge error
		return true;
	}

	private isValidWHERE(where: any): boolean {
		const whereKeys = Object.keys(where);
		// Check if WHERE is empty
		if (whereKeys.length === 0) {
			return true;
		}

		// Check if WHERE has only 1 FILTER
		if (whereKeys.length !== 1) {
			return false;
		}

		// Check if FILTER is a LogicComparison
		if (whereKeys.includes("AND") || whereKeys.includes("OR")) {
			return this.isValidLogicComparison(where);
		}

		// Check if FILTER is a MComparison
		if (whereKeys.includes("GT") || whereKeys.includes("LT") || whereKeys.includes("EQ")) {
			return this.isValidMComparison(where);
		}

		// Check if FILTER is a SComparision
		if (whereKeys.includes("IS")) {
			return this.isValidSComparison(where);
		}

		// Check if FILTER is a Negation
		if (whereKeys.includes("NOT")) {
			return this.isValidNegation(where);
		}

		// if whereKey doesn't match with the four options, return false
		return false;
	}

	private isValidLogicComparison(filter: any): boolean {
		const logic = Object.keys(filter)[0];
		const filter_list = filter[logic];
		for (const filter of filter_list) {
			if (!this.isValidWHERE(filter)) {
				return false;
			}
		}
		return true;
	}

	private isValidMComparison(filter: any): boolean {
		const mcomparator = Object.keys(filter)[0];
		const mcomparison = filter[mcomparator];
		const mkey = Object.keys(mcomparison);
		const mkeyText = mkey[0];

		if (mkey.length !== 1) {
			return false;
		}

		const mfield = mcomparison[mkeyText];
		if (typeof mfield != "number") {
			return false;
		}

		// TODO: check if valid id

		// Split the mkey
		// e.g, For sections_avg, prefix = "sections", postfix = "avg"

		// TODO: check for the validity of prefix when actually performing query
		const prefix = mkeyText.split("_")[0];
		const postfix = mkeyText.split("_")[1];
		if (this.getValidMkey(mkeyText) == "") {
			return false;
		}

		return true;
	}

	private isValidSComparison(filter: any): boolean {
		const scomparator = Object.keys(filter)[0];
		const scomparison = filter[scomparator];
		const skey = Object.keys(scomparison);
		const skeyText = skey[0];

		if (skey.length !== 1) {
			return false;
		}

		// TODO: check if valid id

		if (this.getValidSkey(skeyText) == "") {
			return false;
		}

		const sfield = scomparison[skeyText];

		if (typeof sfield != "string") {
			return false;
		}

		if (!this.isValidWildCard(sfield)) {
			return false;
		}

		return true;
	}

	private isValidNegation(filter: any): boolean {
		const notFilter = filter["NOT"];

		return this.isValidWHERE(notFilter);
	}

	private isValidOPTIONS(options: any): boolean {
		const optionsKeys = Object.keys(options);

		// there must be either 1 or 2 keys
		if (optionsKeys.length != 1 && optionsKeys.length != 2) {
			return false;
		}

		// Check if OPTIONS contains COLUMNS
		if (!optionsKeys.includes("COLUMNS")) {
			return false;
		}
		// Check if the first element if COLUMNS
		if (optionsKeys[0] !== "COLUMNS") {
			return false;
		}
		// If there are two elements, make sure the second element is ORDER
		if (optionsKeys.length === 2 && optionsKeys[1] !== "ORDER") {
			return false;
		}
		// check the validity of each column in columns
		const columns = options[optionsKeys[0]];
		for (const col of columns) {
			if (this.getValidMkey(col) == "" && this.getValidSkey(col) == "") {
				return false;
			}
		}

		// if ORDER exists, check the validity of each key
		if (optionsKeys.length === 2) {
			const orderKeys = options[optionsKeys[1]];
			if (this.getValidMkey(orderKeys) == "" && this.getValidSkey(orderKeys) == "") {
				return false;
			}
		}

		return true;
	}

	public processQuery(query: unknown, datasetMap: Map<string, InsightDataset>): InsightResult[] {
		const stringified = JSON.stringify(query);
		const parsedQuery = JSON.parse(stringified);

		const filteredSection = this.processWHERE(parsedQuery.WHERE, datasetMap);
		const InsightResultList = [];
		// TODO: Apply COLUMN and ORDER
		for (const section of filteredSection) {
			InsightResultList.push({ sections_dept: section["dept"], sections_avg: section["avg"] });
		}
		return InsightResultList;

		// AFTER RESULTS HAS BEEN PROCESSED: If the result is greater than 5000, Reject with ResultTooLarge error
		return [];
	}
	// basically handling Filter
	private processWHERE(queryWHERE: unknown, datasetMap: Map<string, InsightDataset>): Section[] {
		if (typeof queryWHERE !== "object" || queryWHERE === null) {
			throw new InsightError("WHERE must be an object");
		}
		const topLevelKeys = Object.keys(queryWHERE);
		// If WHERE is empty, return all entries
		// if (topLevelKeys.length === 0) {
		// 	return datasetMap.values();
		// }

		const filter = topLevelKeys[0];

		// IF WHERE has FILTER, pass on current entries to the filter helper
		if (filter == "AND" || filter == "OR") {
			console.log("logic");
		} else if (filter == "GT" || filter == "LT" || filter == "EQ") {
			// TODO: do i have to consider when handleMComparison throws an Error?
			return this.handleMComparison(queryWHERE, datasetMap);
		} else if (filter == "IS") {
			return this.handleSComparison(queryWHERE, datasetMap);
		} else if (filter == "NOT") {
			console.log("NEGATIOn");
		}

		throw new InsightError("filter is NOT valid");
	}

	// private handleLogic(queryLOGIC: unknown, datasetMap: Map<string, InsightDataset>): Map<string, InsightDataset> {}

	private handleMComparison(queryMComparator: unknown, datasetMap: Map<string, InsightDataset>): Section[] {
		// need this check to call Object.keys
		if (typeof queryMComparator !== "object" || queryMComparator === null) {
			throw new InsightError("MComparator must be an object");
		}
		// get the Mcomparator
		const Mcomparator = Object.keys(queryMComparator)[0];

		// assign the correct type to tell Typescript that its a key:value type
		// ex) { GT: { sections_avg: 97 } }
		const comparatorObj = queryMComparator as Record<string, object>;

		// get the mkey:number object
		// ex) { sections_avg: 97 }
		const McomparatorValue = comparatorObj[Mcomparator];

		// get the Mkey
		// ex) sections_avg
		const Mkey = Object.keys(McomparatorValue)[0];

		if (typeof McomparatorValue !== "object" || McomparatorValue === null) {
			throw new InsightError("McomparatorValue must be an object with a valid Mkey");
		}

		const McomparatorValueObj = McomparatorValue as Record<string, number>;
		// ex) 97
		const MkeyValue = McomparatorValueObj[Mkey];
		try {
			const filterSections = this.handleMComparisonFiltering(Mcomparator, Mkey, MkeyValue, datasetMap);
			return filterSections;
		} catch (err) {
			throw err;
		}
	}

	private handleMComparisonFiltering(
		Mcomparator: String,
		Mkey: string,
		MkeyValue: number,
		datasetMap: Map<string, InsightDataset>
	): Section[] {
		const id: string = this.getID(Mkey);
		// typeof ds == InsightDataset
		const ds = datasetMap.get(id);
		if (!ds) {
			throw new InsightError(`Dataset with ID ${id} not found.`);
		}

		// typeof dsSectionsDataset == SectionsDataset
		const dsSectionsDataset = ds as SectionsDataset;
		const sections = dsSectionsDataset.sections;

		const filteredSections: Section[] = [];
		for (const section of sections) {
			// ex) avg, pass, fail
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
					break;
				}
				case "GT": {
					if (sectionValue > MkeyValue) {
						filteredSections.push(section);
					}
					break;
				}
				case "GT": {
					if (sectionValue < MkeyValue) {
						filteredSections.push(section);
					}
					break;
				}
				default:
					console.error(`Invalid comparator: ${Mcomparator}`);
			}
		}
		return filteredSections;
	}

	private handleSComparison(querySComparator: unknown, datasetMap: Map<string, InsightDataset>): Section[] {
		// need this check to call Object.keys
		if (typeof querySComparator !== "object" || querySComparator === null) {
			throw new InsightError("SComparator must be an object");
		}
		// get the SComparator
		const SComparator = Object.keys(querySComparator)[0];

		// assign the correct type to tell Typescript that its a key:value type
		// ex) { IS: { sections_dept: 'cpsc' } }
		const comparatorObj = querySComparator as Record<string, object>;

		// get the skey:inputstring object
		// ex) { sections_dept: 'cpsc' }
		const ScomparatorValue = comparatorObj[SComparator];

		// get the Skey
		// ex) sections_dept
		const Skey = Object.keys(ScomparatorValue)[0];

		if (typeof ScomparatorValue !== "object" || ScomparatorValue === null) {
			throw new InsightError("ScomparatorValue must be an object with a valid Skey");
		}

		const ScomparatorValueObj = ScomparatorValue as Record<string, string>;
		// ex) cpsc
		const SkeyValue = ScomparatorValueObj[Skey];

		try {
			const filterSections = this.handleSComparisonFiltering(Skey, SkeyValue, datasetMap);
			return filterSections;
		} catch (err) {
			throw err;
		}
	}

	private handleSComparisonFiltering(
		Skey: string,
		SkeyValue: string,
		datasetMap: Map<string, InsightDataset>
	): Section[] {
		const id: string = this.getID(Skey);
		// typeof ds == InsightDataset
		const ds = datasetMap.get(id);
		if (!ds) {
			throw new InsightError(`Dataset with ID ${id} not found.`);
		}

		// typeof dsSectionsDataset == SectionsDataset
		const dsSectionsDataset = ds as SectionsDataset;
		const sections = dsSectionsDataset.sections;

		const filteredSections: Section[] = [];
		for (const section of sections) {
			// ex) dept, id, instructor
			const SkeyField = this.getValidSkey(Skey);

			if (SkeyField == "") {
				throw new InsightError("Invalid Mkey");
			}

			const sectionValue = section[SkeyField];

			// Check if sectionValue contains SkeyValue
			if (SkeyValue[0] === "*" && SkeyValue[SkeyValue.length - 1] === "*") {
				const inputstring = SkeyValue.substring(1, SkeyValue.length - 1);
				if (sectionValue.includes(inputstring)) {
					filteredSections.push(section);
				}
				continue;
			}
			// Check if sectionValue starts with SkeyValue
			if (SkeyValue[SkeyValue.length - 1] === "*") {
				const inputstring = SkeyValue.substring(0, SkeyValue.length - 1);
				if (sectionValue.startsWith(inputstring)) {
					filteredSections.push(section);
				}
				continue;
			}
			// Check if sectionValue ends with SkeyValue
			if (SkeyValue[0] === "*") {
				const inputstring = SkeyValue.substring(1);
				if (sectionValue.endsWith(inputstring)) {
					filteredSections.push(section);
				}
				continue;
			}

			// Check if sectionValue === SkeyValue
			if (sectionValue === SkeyValue) {
				filteredSections.push(section);
			}
		}
		return filteredSections;
	}

	// private handleNegation(queryNegation: unknown, datasetMap: Map<string, InsightDataset>): Map<string, InsightDataset> {}

	// Validity Functions

	private isValidWildCard(wildcard: String) {
		for (let i = 1; i < wildcard.length - 1; i++) {
			const char: string = wildcard[i];
			if (char === "*") {
				return false;
			}
		}
		return true;
	}

	private getValidMkey(Mkey: String) {
		// TODO: check if id is valid first
		let underscoreIndex = 0;
		for (let i = 0; i < Mkey.length; i++) {
			const char: string = Mkey[i];
			if (char === "_") {
				underscoreIndex = i;
				break;
			}
		}
		const mkey = Mkey.substring(underscoreIndex + 1);
		if (mkey === "avg" || mkey === "pass" || mkey === "fail" || mkey === "audit" || mkey === "year") {
			return mkey;
		}
		return "";
	}

	private getValidSkey(Skey: String) {
		// TODO: check if id is valid first

		let underscoreIndex = 0;
		for (let i = 0; i < Skey.length; i++) {
			const char: string = Skey[i];
			if (char === "_") {
				underscoreIndex = i;
				break;
			}
		}
		const skey = Skey.substring(underscoreIndex + 1);
		if (skey === "dept" || skey === "id" || skey === "instructor" || skey === "title" || skey == "uuid") {
			return skey;
		}
		return "";
	}

	private getID(key: String) {
		let underscoreIndex = 0;
		for (let i = 0; i < key.length; i++) {
			const char: string = key[i];
			if (char === "_") {
				underscoreIndex = i;
				break;
			}
		}
		return key.substring(0, underscoreIndex);
	}
}
