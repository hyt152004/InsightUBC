import { InsightDataset, InsightError, InsightResult, ResultTooLargeError } from "./IInsightFacade";
import Section from "../model/Section";

export default class QueryEngine {
	public datasetID: string;

	constructor(id: string) {
		this.datasetID = id;
	}

	public processQuery(query: any, id: string, datasetMap: Map<string, InsightDataset>): InsightResult[] {
		// Parse Query
		const parsedQuery = JSON.parse(JSON.stringify(query));

		// Parse Dataset
		const dataset = datasetMap.get(id);
		const parsedDataset = JSON.parse(JSON.stringify(dataset));

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
		const result: Section[] = [];

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
		const skey = Object.keys(scomparison)[0];
		const sfieldValue = scomparison[skey];

		if (sfieldValue === "*" || sfieldValue === "**") {
			return filteredResult;
		}

		return filteredResult.filter((section: any) => {
			const sectionValue = section[skey];
			if (sfieldValue.startsWith("*") && sfieldValue.endsWith("*")) {
				return sectionValue.includes(sfieldValue.slice(1, -1));
			} else if (sfieldValue.startsWith("*")) {
				return sectionValue.endsWith(sfieldValue.slice(1));
			} else if (sfieldValue.endsWith("*")) {
				return sectionValue.startsWith(sfieldValue.slice(0, -1));
			} else {
				return sectionValue === sfieldValue;
			}
		});
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
}
