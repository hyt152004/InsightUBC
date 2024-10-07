import Log from "../../util/Log";

export default class QueryEngine {
	
	public isValidQuery(query: unknown): boolean {
		// Check if query is of type Object, Reject with InsightError if not
		if (typeof query !== "object" || query === null) {
			return false;
		}

		// Parse query
		const stringified = JSON.stringify(query);
		const parsedQuery = JSON.parse(stringified);
		const topLevelKeys = Object.keys(parsedQuery);

		//Check if query contains both WHERE and OPTIONS
		if (!(topLevelKeys.includes("WHERE") && topLevelKeys.includes("OPTIONS"))) {
			return false;
		}

		const optionsKeys = Object.keys(parsedQuery.OPTIONS);

		// Check if OPTIONS contains COLUMNS
		if (!optionsKeys.includes("COLUMNS")) {
			return false;
		}

		// Check if all keys and fields are valid inside WHERE
		if (!this.isValidWHERE(parsedQuery.WHERE)) {
			return false;
		}

		// AFTER RESULTS HAS BEEN PROCESSED: If the result is greater than 5000, Reject with ResultTooLarge error
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

		// Check if FILTER is a MComparison
		if (whereKeys.includes("GT") || whereKeys.includes("LT") || whereKeys.includes("EQ")) {
			return this.isValidMComparison(where);
		}

		return true;
	}

	private isValidMComparison(filter: any): boolean {
		const mcomparator = Object.keys(filter)[0];
		const mcomparison = filter[mcomparator];
		const mkey = Object.keys(mcomparison);

		if (mkey.length !== 1) {
			return false;
		}

		// Split the mkey
		// e.g, For sections_avg, prefix = "sections", postfix = "avg"
		const mkeyText = mkey[0];
		const prefix = mkeyText.split("_")[0];
		const postfix = mkeyText.split("_")[1];

		return true;
	}

	// private handleWHERE() {
	//     // If WHERE is empty, return all entries

	//     // IF WHERE has FILTER, pass on current entries to the filter helper
	// }

	// private handleOPTIONS() {}

	// private MComparator() {}

	// private validateWildCard() {}
}
