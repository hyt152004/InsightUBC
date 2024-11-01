export default class QueryValidator {
	public datasetID: string;
	public datasetKind: string;
	private transformationsKeyList = new Set();
	private hasTransformations = false;

	constructor(id: string) {
		this.datasetID = id;
		this.datasetKind = "";
	}

	public isValidQuery(query: unknown): boolean {
		// Check if query is of type Object, Reject with InsightError If not
		if (typeof query !== "object" || query === null) {
			return false;
		}

		const parsedQuery = JSON.parse(JSON.stringify(query));
		const topLevelKeys = Object.keys(parsedQuery);

		// Check if topLevelKeys include WHERE and OPTIONS
		const maxTopLevelKeys = 3;
		if (topLevelKeys.length === maxTopLevelKeys - 1) {
			if (!topLevelKeys.includes("WHERE") || !topLevelKeys.includes("OPTIONS")) {
				return false;
			}
		} else if (topLevelKeys.length === maxTopLevelKeys) {
			if (
				!topLevelKeys.includes("WHERE") ||
				!topLevelKeys.includes("OPTIONS") ||
				!topLevelKeys.includes("TRANSFORMATIONS")
			) {
				return false;
			}
		} else {
			return false;
		}
		// set kind operation here
		const optionsKeys = Object.keys(parsedQuery.OPTIONS);
		// Check if OPTIONS contains COLUMNS and if its the first element
		if (!optionsKeys.includes("COLUMNS") || optionsKeys[0] !== "COLUMNS") {
			return false;
		}
		// check the validity of each column in columns
		const columns = parsedQuery.OPTIONS[optionsKeys[0]];

		if (!Array.isArray(columns) || columns.length === 0) {
			return false;
		}

		if (this.datasetKind === "") {
			this.setDatasetKind(columns[0]);
		}
		if (topLevelKeys.includes("TRANSFORMATIONS")) {
			if (!this.isValidTRANSFORMATIONS(parsedQuery.TRANSFORMATIONS)) {
				return false;
			}
			this.hasTransformations = true;
		}
		// Check if all keys and fields are valid inside WHERE
		if (!this.isValidOPTIONS(parsedQuery.OPTIONS) || !this.isValidWHERE(parsedQuery.WHERE)) {
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

		if (!Array.isArray(filterList)) {
			return false;
		}

		if (filterList.length === 0) {
			return false;
		}

		for (const logicfilter of filterList) {
			if (Object.keys(logicfilter).length === 0) {
				return false;
			}
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

		if (this.datasetKind === "sectionKind") {
			if (mkey.length !== 1 || this.getValidSectionMkey(mkeyText) === "") {
				return false;
			}
		} else {
			if (mkey.length !== 1 || this.getValidRoomMkey(mkeyText) === "") {
				return false;
			}
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
		if (this.datasetKind === "sectionKind") {
			if (skey.length !== 1 || this.getValidSectionSkey(skeyText) === "") {
				return false;
			}
		} else {
			if (skey.length !== 1 || this.getValidRoomSkey(skeyText) === "") {
				return false;
			}
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

		// If there are two elements, make sure the second element is ORDER
		if (optionsKeys.length === maxOptionsKeys && optionsKeys[1] !== "ORDER") {
			return false;
		}
		// check the validity of each column in columns
		const columns = options[optionsKeys[0]];

		for (const col of columns) {
			if (this.hasTransformations) {
				if (!this.transformationsKeyList.has(col)) {
					return false;
				}
			} else if (this.datasetKind === "sectionKind") {
				if (this.getValidSectionMkey(col) === "" && this.getValidSectionSkey(col) === "") {
					return false;
				}
			} else {
				if (this.getValidRoomMkey(col) === "" && this.getValidRoomSkey(col) === "") {
					return false;
				}
			}
		}

		// if ORDER exists, check the validity of each key
		if (optionsKeys.length === maxOptionsKeys) {
			if (!this.isValidSort(options[optionsKeys[1]], columns)) {
				return false;
			}
		}

		return true;
	}

	private isValidSort(sort: any, columns: any): boolean {
		// Single Column
		if (typeof sort === "string") {
			// At this point, we are guaranteed all column keys are valid
			if (!columns.includes(sort)) {
				return false;
			}
		} else {
			const sortKeys = Object.keys(sort);
			const sortBodyLength = 2;
			if (sortKeys.length !== sortBodyLength || !sortKeys.includes("dir") || !sortKeys.includes("keys")) {
				return false;
			}

			if (sortKeys[0] !== "dir" && sortKeys[1] !== "keys") {
				return false;
			}

			if (sort.dir !== "UP" && sort.dir !== "DOWN") {
				return false;
			}

			if (!Array.isArray(sort.keys) || sort.keys.length === 0) {
				return false;
			}

			for (const key of sort.keys) {
				if (!columns.includes(key)) {
					return false;
				}
			}
		}

		return true;
	}

	private isValidTRANSFORMATIONS(transformations: any): boolean {
		const transformationsKeys = Object.keys(transformations);

		const maxTransformationKeys = 2;
		if (transformationsKeys.length !== maxTransformationKeys) {
			return false;
		}

		// Check if TRANSFORMATIONS contains GROUP and APPLY
		if (!transformationsKeys.includes("GROUP") || !transformationsKeys.includes("APPLY")) {
			return false;
		}
		if (!this.isValidGROUP(transformations.GROUP) || !this.isValidAPPLY(transformations.APPLY)) {
			return false;
		}

		return true;
	}

	private isValidGROUP(group: any): boolean {
		if (!Array.isArray(group) || group.length === 0) {
			return false;
		}
		for (const key of group) {
			if (this.datasetKind === "sectionKind") {
				if (this.getValidSectionMkey(key) === "" && this.getValidSectionSkey(key) === "") {
					return false;
				}
			} else {
				if (this.getValidRoomMkey(key) === "" && this.getValidRoomSkey(key) === "") {
					return false;
				}
			}
		}

		// Add all group keys to transformation key list
		for (const key of group) {
			this.transformationsKeyList.add(key);
		}
		return true;
	}

	private isValidAPPLY(apply: any): boolean {
		if (!Array.isArray(apply)) {
			return false;
		}

		const applyKeys = [];

		for (const applyRule of apply) {
			// Each item in APPLY should only have 1 key
			if (Object.keys(applyRule).length !== 1) {
				return false;
			}

			const applyKey = Object.keys(applyRule)[0];

			if (this.invalidKey(applyKey)) {
				return false;
			}
			const applyBody = applyRule[applyKey];

			// Each APPLY body item should only take 1 APPLYTOKEN
			if (Object.keys(applyBody).length !== 1) {
				return false;
			}

			const applyToken = Object.keys(applyBody)[0];
			const applyItem = applyBody[applyToken];

			if (!this.isValidApplyToken(applyToken, applyItem)) {
				return false;
			}

			applyKeys.push(applyKey);
		}

		// If apply key list has duplicates
		if (new Set(applyKeys).size !== applyKeys.length) {
			return false;
		}

		// Add all applyKeys to transformation key list
		for (const key of applyKeys) {
			this.transformationsKeyList.add(key);
		}
		return true;
	}

	// Validity Functions
	private invalidKey(key: string): boolean {
		if (key === null || key.trim() === "" || key.includes("_")) {
			return true;
		}

		return false;
	}

	private isValidApplyToken(token: string, key: string): boolean {
		if (token !== "MAX" && token !== "MIN" && token !== "AVG" && token !== "COUNT" && token !== "SUM") {
			return false;
		}
		// COUNT should accept all keys
		if (token === "COUNT") {
			if (this.datasetKind === "sectionKind") {
				if (this.getValidSectionMkey(key) === "" && this.getValidSectionSkey(key) === "") {
					return false;
				}
			} else {
				if (this.getValidRoomMkey(key) === "" && this.getValidRoomSkey(key) === "") {
					return false;
				}
			}
		} else if (token === "MAX" || token === "MIN" || token === "AVG" || token === "SUM") {
			if (this.datasetKind === "sectionKind") {
				if (this.getValidSectionMkey(key) === "") {
					return false;
				}
			} else {
				if (this.getValidRoomMkey(key) === "") {
					return false;
				}
			}
		}

		return true;
	}

	private isValidWildCard(wildcard: string): boolean {
		if (wildcard.length === 0) {
			return true;
		}

		const startsWithAsterisk = wildcard[0] === "*";
		const endsWithAsterisk = wildcard[wildcard.length - 1] === "*";

		for (let i = startsWithAsterisk ? 1 : 0; i < (endsWithAsterisk ? wildcard.length - 1 : wildcard.length); i++) {
			if (wildcard[i] === "*") {
				return false;
			}
		}

		return true;
	}

	private getValidSectionMkey(Mkey: string): string {
		if (!this.isValidIDKey(Mkey)) {
			return "";
		}
		const mkey = Mkey.split("_")[1];
		if (mkey === "avg" || mkey === "pass" || mkey === "fail" || mkey === "audit" || mkey === "year") {
			return mkey;
		}
		return "";
	}

	private getValidRoomMkey(Mkey: string): string {
		if (!this.isValidIDKey(Mkey)) {
			return "";
		}
		const mkey = Mkey.split("_")[1];
		if (mkey === "lat" || mkey === "lon" || mkey === "seats") {
			return mkey;
		}
		return "";
	}

	private getValidSectionSkey(Skey: string): string {
		if (!this.isValidIDKey(Skey)) {
			return "";
		}
		const skey = Skey.split("_")[1];
		if (skey === "dept" || skey === "id" || skey === "instructor" || skey === "title" || skey === "uuid") {
			return skey;
		}
		return "";
	}

	private getValidRoomSkey(Skey: string): string {
		if (!this.isValidIDKey(Skey)) {
			return "";
		}
		const skey = Skey.split("_")[1];
		if (skey === "fullname" || skey === "shortname" || skey === "number" || skey === "name") {
			return skey;
		}
		if (skey === "address" || skey === "type" || skey === "furniture" || skey === "href") {
			return skey;
		}
		return "";
	}

	private isValidIDKey(key: string): boolean {
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

	private setDatasetKind(column: string): void {
		if (
			column.includes("fullname") ||
			column.includes("shortname") ||
			column.includes("number") ||
			column.includes("name")
		) {
			this.datasetKind = "roomKind";
		} else if (column.includes("address") || column.includes("lat") || column.includes("lon")) {
			this.datasetKind = "roomKind";
		} else if (
			column.includes("seats") ||
			column.includes("type") ||
			column.includes("furniture") ||
			column.includes("href")
		) {
			this.datasetKind = "roomKind";
		} else {
			this.datasetKind = "sectionKind";
		}
	}
}
