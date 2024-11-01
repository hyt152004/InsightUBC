import { InsightDataset, InsightError, InsightResult, ResultTooLargeError } from "./IInsightFacade";
import Decimal from "decimal.js";

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
		if (parsedQuery.TRANSFORMATIONS) {
			filteredResult = this.processTRANSFORMATIONS(parsedQuery.TRANSFORMATIONS, filteredResult);
		}
		filteredResult = this.processOPTION(parsedQuery.OPTIONS, filteredResult);

		// AFTER RESULTS HAS BEEN PROCESSED: If the result is greater than 5000, Reject with ResultTooLarge error
		const maximumResults = 5000;
		if (filteredResult.length > maximumResults) {
			throw new ResultTooLargeError("Result is greater than 5000 entries");
		} else {
			return filteredResult;
		}
	}

	private processWHERE(queryWHERE: any, filteredResult: any): any[] {
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

	private processTRANSFORMATIONS(queryTRANSFORMATIONS: any, filteredResult: any): any[] {
		const groupKeys = queryTRANSFORMATIONS.GROUP;
		const applyRules = queryTRANSFORMATIONS.APPLY;
		const groupedData = new Map<string, any[]>();

		// Transform result into groups of data
		for (const item of filteredResult) {
			const groupName = groupKeys.map((key: string) => item[key]).join("|");
			if (!groupedData.has(groupName)) {
				groupedData.set(groupName, []);
			}
			groupedData.get(groupName)!.push(item);
		}

		const allGroups = Array.from(groupedData.values());
		const result = [];

		for (const group of allGroups) {
			let transformedGroup = group[0];

			if (applyRules.length > 0) {
				transformedGroup = this.processAPPLY(applyRules, group);
			}

			result.push(transformedGroup);
		}

		filteredResult = result;

		return filteredResult;
	}

	private processAPPLY(apply: any, group: any): any[] {
		const result = group[0];
		for (const applyRule of apply) {
			const applyKey = Object.keys(applyRule)[0];
			const applyBody = applyRule[applyKey];
			const applyToken = Object.keys(applyBody)[0];
			const applyItem = applyBody[applyToken];

			if (applyToken === "MAX") {
				result[applyKey] = this.handleMAX(applyItem, group);
			}

			if (applyToken === "MIN") {
				result[applyKey] = this.handleMIN(applyItem, group);
			}

			if (applyToken === "AVG") {
				result[applyKey] = this.handleAVG(applyItem, group);
			}

			if (applyToken === "SUM") {
				result[applyKey] = this.handleSUM(applyItem, group);
			}

			if (applyToken === "COUNT") {
				result[applyKey] = this.handleCOUNT(applyItem, group);
			}
		}

		return result;
	}

	private handleMAX(applyItem: any, group: any): number {
		let max = group[0][applyItem];
		for (const item of group) {
			if (item[applyItem] > max) {
				max = item[applyItem];
			}
		}
		return max;
	}

	private handleMIN(applyItem: any, group: any): number {
		let min = group[0][applyItem];
		for (const item of group) {
			if (item[applyItem] < min) {
				min = item[applyItem];
			}
		}
		return min;
	}

	private handleAVG(applyItem: any, group: any): number {
		let total = new Decimal(0);
		for (const item of group) {
			total = Decimal.add(total, new Decimal(item[applyItem]));
		}
		const numRows = group.length;
		const avg = total.toNumber() / numRows;
		const decimalPlace = 2;
		return Number(avg.toFixed(decimalPlace));
	}

	private handleSUM(applyItem: any, group: any): number {
		let sum = 0;
		for (const item of group) {
			sum += item[applyItem];
		}
		const decimalPlace = 2;
		return Number(sum.toFixed(decimalPlace));
	}

	private handleCOUNT(applyItem: any, group: any): number {
		const uniqueList: any[] = [];
		for (const item of group) {
			if (!uniqueList.includes(item[applyItem])) {
				uniqueList.push(item[applyItem]);
			}
		}
		return uniqueList.length;
	}

	private processOPTION(queryOPTION: any, filteredResult: any): any[] {
		const columnKeys = queryOPTION.COLUMNS;
		const result: any[] = [];

		for (const item of filteredResult) {
			result.push(item);
		}

		for (const record of result) {
			for (const key of Object.keys(record)) {
				if (!columnKeys.includes(key)) {
					delete record[key];
				}
			}
		}

		filteredResult = result;

		if (queryOPTION.ORDER !== null && queryOPTION.ORDER !== undefined) {
			filteredResult = this.processORDER(queryOPTION.ORDER, filteredResult);
		}

		return filteredResult;
	}

	private processORDER(queryORDER: any, filteredResult: any): any[] {
		if (typeof queryORDER === "string") {
			filteredResult = this.handleSort(queryORDER, filteredResult);
		} else {
			filteredResult = this.handleSortDir(queryORDER, filteredResult);
		}

		return filteredResult;
	}

	private handleSort(queryORDER: any, filteredResult: any): any[] {
		filteredResult.sort(function (a: any, b: any) {
			if (a[queryORDER] > b[queryORDER]) {
				return 1;
			} else if (a[queryORDER] < b[queryORDER]) {
				return -1;
			} else {
				return 0;
			}
		});
		return filteredResult;
	}

	private handleSortDir(queryORDER: any, filteredResult: any): any[] {
		if (queryORDER.dir === "UP") {
			filteredResult.sort(function (a: any, b: any) {
				for (const key of queryORDER.keys) {
					if (a[key] > b[key]) {
						return 1;
					} else if (a[key] < b[key]) {
						return -1;
					} else {
						return 0;
					}
				}
			});
		} else {
			filteredResult.sort(function (a: any, b: any) {
				for (const key of queryORDER.keys) {
					if (a[key] > b[key]) {
						return -1;
					} else if (a[key] < b[key]) {
						return 1;
					} else {
						return 0;
					}
				}
			});
		}
		return filteredResult;
	}

	private handleLogic(queryLOGIC: any, filteredResult: any): any[] {
		const logic = Object.keys(queryLOGIC)[0];
		const filterList = queryLOGIC[logic];
		let result: any[] = [];

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
			let filteredOR: any[] = [];

			for (const filter of filterList) {
				filteredOR = filteredOR.concat(this.processWHERE(filter, filteredResult));
			}

			result = Array.from(new Set(filteredOR));
		}

		return result;
	}

	private handleMComparison(queryMComparator: any, filteredResult: any): any[] {
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

	private handleSComparison(querySComparator: any, filteredResult: any): any[] {
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

	private handleNegation(queryNegation: any, filteredResult: any): any[] {
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
