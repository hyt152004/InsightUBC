import JSZip from "jszip";
import { InsightDataset, InsightDatasetKind, InsightError } from "./IInsightFacade";
import Log from "../../util/Log";
import Section from "../model/Section";
import SectionsDataset from "../model/SectionsDataset";

export default class DatasetProcessor {
	public async addSectionsDataset(id: string, content: string, kind: InsightDatasetKind): Promise<InsightDataset> {
		const jszip = new JSZip();
		let fs = require("fs-extra");

		return new Promise<InsightDataset>((resolve, reject) => {
			//TODO: Split codes into helper functions (function cannot exceed 35 lines)
			// Validate Dataset ID
			if (this.invalidId(id)) {
				reject(new InsightError("Invalid ID"));
			}

			// Load zip content
			jszip
				.loadAsync(content, { base64: true })
				.then((zip) => {
					const coursesFolder = zip.folder(/^courses\/$/);
					const coursesList: Promise<string>[] = [];
					let allValidSections: Section[] = [];

					// Check if courses folder exists and is at root level
					if (coursesFolder !== null && coursesFolder.length > 0) {
						zip.folder("courses")?.forEach(function (relativePath: string, file: any) {
							coursesList.push(file.async("string"));
						});
					} else {
						return reject(new InsightError("courses folder not found"));
					}

					// Wait until all courses are processed
					Promise.all(coursesList)
						.then((coursesResult) => {
							// Validate each section of each course
							for (const JSONfile of coursesResult) {
								const course = JSON.parse(JSONfile);
								for (const section of course["result"]) {
									// TODO: add more check cases (missing other fields)
									// If a section has missing field, it is invalid (skip it)
									if (!section.hasOwnProperty("Subject")) {
										continue;
									}
									const validSection = new Section(section);
									allValidSections.push(validSection);
								}
							}
						})
						.catch((err) => {
							return reject(new InsightError("error"));
						});

					// Return an InsightDataset with all the valid sections added 
					let ds = new SectionsDataset(id, kind, allValidSections.length, allValidSections);
					return resolve(ds);
				})
				.catch((err) => {
					return reject(new InsightError("Error unzipping content"));
				});
		});
	}

	private invalidId(id: string): boolean {
		//TODO: add more check cases
		if (id === null) {
			return true;
		}
		if (id === "") {
			return true;
		}
		if (id.includes("_")) {
			return true;
		}
		return false;
	}
}
