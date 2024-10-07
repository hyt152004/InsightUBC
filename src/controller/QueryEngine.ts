import { InsightDataset, InsightError, InsightResult, ResultTooLargeError } from "./IInsightFacade";
import Section from "../model/Section";
import { log } from "console";

export default class QueryEngine {
	public datasetID: string;
	private datasetSections: Section[];

	constructor(id: string) {
		this.datasetID = id;
		this.datasetSections = [];
	}

	public isValidQuery(query: unknown): boolean {
		// Check if query is of type Object, Reject with InsightError if not
		if (typeof query !== "object" || query === null) {
			return false;
		}

		const parsedQuery = JSON.parse(JSON.stringify(query));
		const topLevelKeys = Object.keys(parsedQuery);

		// Check if only WHERE and OPTIONS exists in topLevelKeys
		const maxTopLevelKeys = 2;
		if (
			!topLevelKeys.includes("WHERE") ||
			!topLevelKeys.includes("OPTIONS") ||
			topLevelKeys.length !== maxTopLevelKeys
		) {
			return false;
		}

		// Check if all keys and fields are valid inside WHERE
		if (!this.isValidWHERE(parsedQuery.WHERE) || !this.isValidOPTIONS(parsedQuery.OPTIONS)) {
			return false;
		}

		// TODO: Check if all keys reference only one dataset

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
		const filterList = filter[logic];
		for (const logicfilter of filterList) {
			if (!this.isValidWHERE(logicfilter)) {
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
		const mfieldValue = mcomparison[mkeyText];

		if (mkey.length !== 1 || this.getValidMkey(mkeyText) === "") {
			return false;
		}

		if (typeof mfieldValue !== "number") {
			return false;
		}
		return true;
	}

	private isValidSComparison(filter: any): boolean {
		const scomparator = Object.keys(filter)[0];
		const scomparison = filter[scomparator];
		const skey = Object.keys(scomparison);
		const skeyText = skey[0];
		const sfieldValue = scomparison[skeyText];

		if (skey.length !== 1 || this.getValidSkey(skeyText) === "") {
			return false;
		}

		if (typeof sfieldValue !== "string" || !this.isValidWildCard(sfieldValue)) {
			return false;
		}

		return true;
	}

	private isValidNegation(filter: any): boolean {
		const notFilter = filter.NOT;

		return this.isValidWHERE(notFilter);
	}

	private isValidOPTIONS(options: any): boolean {
		const optionsKeys = Object.keys(options);

		// there must be either 1 or 2 keys
		const maxOptionsKeys = 2;
		if (optionsKeys.length !== 1 && optionsKeys.length !== maxOptionsKeys) {
			return false;
		}

		// Check if OPTIONS contains COLUMNS and if its the first element
		if (!optionsKeys.includes("COLUMNS") || optionsKeys[0] !== "COLUMNS") {
			return false;
		}

		// If there are two elements, make sure the second element is ORDER
		if (optionsKeys.length === maxOptionsKeys && optionsKeys[1] !== "ORDER") {
			return false;
		}
		// check the validity of each column in columns
		const columns = options[optionsKeys[0]];
		for (const col of columns) {
			if (this.getValidMkey(col) === "" && this.getValidSkey(col) === "") {
				return false;
			}
		}

		// if ORDER exists, check the validity of each key
		if (optionsKeys.length === maxOptionsKeys) {
			const orderKeys = options[optionsKeys[1]];
			if (this.getValidMkey(orderKeys) === "" && this.getValidSkey(orderKeys) === "") {
				return false;
			}
			if (!columns.includes(orderKeys)) {
				return false;
			}
		}

		return true;
	}

	public processQuery(query: any, id: string, datasetMap: Map<string, InsightDataset>): InsightResult[] {
		// Parse Query
		const parsedQuery = JSON.parse(JSON.stringify(query));

		// Parse Dataset
		const dataset = datasetMap.get(id);
		const parsedDataset = JSON.parse(JSON.stringify(dataset));

		this.datasetSections = parsedDataset.sections;
		let filteredResult = parsedDataset.sections;

		filteredResult = this.processWHERE(parsedQuery.WHERE, filteredResult);
		filteredResult = this.processOPTION(parsedQuery.OPTIONS, filteredResult);

		// AFTER RESULTS HAS BEEN PROCESSED: If the result is greater than 5000, Reject with ResultTooLarge error
		const maximumResults = 5000;
		if (filteredResult.length > maximumResults) {
			throw new ResultTooLargeError("Result is greater than 5000 entries");
		} else {
			return filteredResult;
		}
	}

	private processWHERE(queryWHERE: any, filteredResult: any): Section[] {
		// If WHERE is empty, return all entries
		if (Object.keys(queryWHERE).length === 0) {
			return filteredResult;
		}

		const filter = Object.keys(queryWHERE)[0];

		// IF WHERE has FILTER, pass on current entries to the filter helper
		if (filter === "AND" || filter === "OR") {
			return this.handleLogic(queryWHERE, filteredResult);
		} else if (filter === "GT" || filter === "LT" || filter === "EQ") {
			// TODO: do i have to consider when handleMComparison throws an Error?
			return this.handleMComparison(queryWHERE, filteredResult);
		} else if (filter === "IS") {
			return this.handleSComparison(queryWHERE, filteredResult);
		} else if (filter === "NOT") {
			return this.handleNegation(queryWHERE, filteredResult);
		}
		throw new InsightError(`filter, ${filter}, is NOT valid`);
	}

	private processOPTION(queryOPTION: any, filteredResult: any): Section[] {
		const columnKeys = queryOPTION.COLUMNS;
		let result: Section[] = [];

		for (const section of filteredResult) {
			const reorderedSection: Section = {} as Section;
			for (const key of columnKeys) {
				reorderedSection[key as keyof Section] = section[key];
			}
			result.push(reorderedSection);
		}
		filteredResult = result;

		if (queryOPTION.ORDER !== null) {
			filteredResult = this.processORDER(queryOPTION.ORDER, filteredResult);
		}

		return filteredResult;
	}

	private processORDER(queryORDER: any, filteredResult: any): Section[] {
		filteredResult.sort(function (a: any, b: any) {
			if (typeof queryORDER === "string") {
				if (a[queryORDER] < b[queryORDER]) {
					return -1;
				} else if (a[queryORDER] > b[queryORDER]) {
					return 1;
				} else {
					return 0;
				}
			} else if (typeof queryORDER === "number") {
				return a[queryORDER] - b[queryORDER];
			}
		});
		return filteredResult;
	}

	private handleLogic(queryLOGIC: any, filteredResult: any): Section[] {
		const logic = Object.keys(queryLOGIC)[0];
		const filterList = queryLOGIC[logic];
		let result: Section[] = [];

		// Case AND
		if (logic === "AND") {
			for (const filter of filterList) {
				filteredResult = this.processWHERE(filter, filteredResult);
			}
			result = filteredResult;
		}

		// Case OR
		else {
			// create a huge list of all sections that match each filter
			let filteredOR: Section[] = [];

			for (const filter of filterList) {
				filteredOR = filteredOR.concat(this.processWHERE(filter, filteredResult));
			}

			result = Array.from(new Set(filteredOR));
		}

		return result;
	}

	private handleMComparison(queryMComparator: any, filteredResult: any): Section[] {
		const mcomparator = Object.keys(queryMComparator)[0];
		const mcomparison = queryMComparator[mcomparator];
		const mkey = Object.keys(mcomparison);
		const mkeyText = mkey[0];
		const mfieldValue = mcomparison[mkeyText];
		const result = [];

		for (const section of filteredResult) {
			const sectionValue = section[mkeyText];

			switch (mcomparator) {
				case "EQ": {
					if (sectionValue === mfieldValue) {
						result.push(section);
					}
					break;
				}
				case "GT": {
					if (sectionValue > mfieldValue) {
						result.push(section);
					}
					break;
				}
				case "LT": {
					if (sectionValue < mfieldValue) {
						result.push(section);
					}
					break;
				}
				default:
				// console.error(`Invalid comparator: ${mcomparator}`);
			}
		}
		return result;
	}

	private handleSComparison(querySComparator: any, filteredResult: any): Section[] {
		const scomparator = Object.keys(querySComparator)[0];
		const scomparison = querySComparator[scomparator];
		const skey = Object.keys(scomparison);
		// const skeyText = skey[0];
		const sfieldValue = scomparison[skey[0]];
		const result = [];

		for (const section of filteredResult) {
			const sectionValue = section[skey[0]];

			// Check if sectionValue contains sfieldValue
			if (sfieldValue[0] === "*" && sfieldValue[sfieldValue.length - 1] === "*") {
				const inputstring = sfieldValue.substring(1, sfieldValue.length - 1);
				if (sectionValue.includes(inputstring)) {
					result.push(section);
				}
				continue;
			}
			// Check if sectionValue starts with sfieldValue
			if (sfieldValue[sfieldValue.length - 1] === "*") {
				const inputstring = sfieldValue.substring(0, sfieldValue.length - 1);
				if (sectionValue.startsWith(inputstring)) {
					result.push(section);
				}
				continue;
			}
			// Check if sectionValue ends with sfieldValue
			if (sfieldValue[0] === "*") {
				const inputstring = sfieldValue.substring(1);
				if (sectionValue.endsWith(inputstring)) {
					result.push(section);
				}
				continue;
			}

			// Check if sectionValue === sfieldValue
			if (sectionValue === sfieldValue) {
				result.push(section);
			}
		}
		return result;
	}

	private handleNegation(queryNegation: any, filteredResult: any): Section[] {
		const result = [];
		const negatedResult = this.processWHERE(queryNegation.NOT, filteredResult);

		for (const section of filteredResult) {
			if (!negatedResult.includes(section)) {
				result.push(section);
			}
		}
		return result;
	}

	// Validity Functions

	private isValidWildCard(wildcard: string): boolean {
		for (let i = 1; i < wildcard.length - 1; i++) {
			const char: string = wildcard[i];
			if (char === "*") {
				return false;
			}
		}
		return true;
	}

	private getValidMkey(Mkey: string): string {
		if (!this.isValidIDKey(Mkey)) {
			return "";
		}
		const mkey = Mkey.split("_")[1];
		if (mkey === "avg" || mkey === "pass" || mkey === "fail" || mkey === "audit" || mkey === "year") {
			return mkey;
		}
		return "";
	}

	private getValidSkey(Skey: string): string {
		if (!this.isValidIDKey(Skey)) {
			return "";
		}
		const skey = Skey.split("_")[1];
		if (skey === "dept" || skey === "id" || skey === "instructor" || skey === "title" || skey === "uuid") {
			return skey;
		}
		return "";
	}

	private isValidIDKey(key: any): boolean {
		const prefix = key.split("_")[0];

		if (this.datasetID === "") {
			this.datasetID = prefix;
		} else {
			if (prefix !== this.datasetID) {
				return false;
			}
		}

		return true;
	}
}
