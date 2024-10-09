export default class QueryValidator {
	public datasetID: string;

	constructor(id: string) {
		this.datasetID = id;
	}

	public isValidQuery(query: unknown): boolean {
		// Check if query is of type Object, Reject with InsightError If not
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
