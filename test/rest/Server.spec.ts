import { expect } from "chai";
import request, { Response } from "supertest";
import { StatusCodes } from "http-status-codes";
import Log from "@ubccpsc310/folder-test/build/Log";
import Server from "../../src/rest/Server";
import * as fs from "fs-extra";
import { clearDisk } from "../TestUtil";

describe("Facade C3", function () {
	let server: Server;
	let pair: Buffer;
	let oneCourse: Buffer;
	let invalidSection: Buffer;
	let oneBuilding: Buffer;
	let missingRoomTable: Buffer;
	let simpleQuery: Buffer;
	let simpleQueryResult: Buffer;

	before(async function () {
		// TODO: start server here once and handle errors properly
		pair = await fs.readFile("./test/resources/archives/pair.zip");
		oneCourse = await fs.readFile("./test/resources/archives/oneValidCourse.zip");
		invalidSection = await fs.readFile("./test/resources/archives/invalidSection.zip");
		oneBuilding = await fs.readFile("./test/resources/archives/campusWithOneBuilding.zip");
		missingRoomTable = await fs.readFile("./test/resources/archives/missingRoomTable.zip");
		simpleQuery = await fs.readFile("./test/resources/queries/c3/simple.json");
		simpleQueryResult = await fs.readFile("./test/resources/queries/c3/simpleResult.json");

		const PORT = 4321;
		server = new Server(PORT);
		try {
			await server.start();
		} catch (_err) {
			Log.trace("Error starting server");
		}
	});

	after(async function () {
		// TODO: stop server here once!
		await server.stop();
	});

	beforeEach(async function () {
		// might want to add some process logging here to keep track of what is going on
		await clearDisk();
	});

	afterEach(async function () {
		// might want to add some process logging here to keep track of what is going on
		await clearDisk();
	});

	// Sample on how to format PUT requests
	it("PUT test for one valid course dataset", function () {
		const id = "ubc";
		const kind = "sections";

		const SERVER_URL = "http://localhost:4321";
		const ENDPOINT_URL = "/dataset/" + id + "/" + kind;
		const ZIP_FILE_DATA = oneCourse;

		try {
			return request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(ZIP_FILE_DATA)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					// some logging here please!
					expect(res.status).to.be.equal(StatusCodes.OK);
					expect(res.body.result).to.have.members([id]);
				})
				.catch(function () {
					// some logging here please!
					expect.fail();
				});
		} catch (err) {
			Log.error(err);
			// and some more logging here!
		}
	});

	it("FAIL to PUT test for invalid section dataset", function () {
		const id = "abc";
		const kind = "sections";

		const SERVER_URL = "http://localhost:4321";
		const ENDPOINT_URL = "/dataset/" + id + "/" + kind;
		const ZIP_FILE_DATA = invalidSection;

		try {
			return request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(ZIP_FILE_DATA)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					// some logging here please!
					expect(res.status).to.be.equal(StatusCodes.BAD_REQUEST);
					expect(res.body.error).to.be.a("string");
				})
				.catch(function () {
					// some logging here please!
					expect.fail();
				});
		} catch (err) {
			Log.error(err);
			// and some more logging here!
		}
	});

	it("PUT test for one valid building dataset", function () {
		const id = "building";
		const kind = "rooms";

		const SERVER_URL = "http://localhost:4321";
		const ENDPOINT_URL = "/dataset/" + id + "/" + kind;
		const ZIP_FILE_DATA = oneBuilding;

		try {
			return request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(ZIP_FILE_DATA)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					// some logging here please!
					expect(res.status).to.be.equal(StatusCodes.OK);
					expect(res.body.result).to.have.members([id]);
				})
				.catch(function () {
					// some logging here please!
					expect.fail();
				});
		} catch (err) {
			Log.error(err);
			// and some more logging here!
		}
	});

	it("FAIL to PUT test for missing room table dataset", function () {
		const id = "missing";
		const kind = "rooms";

		const SERVER_URL = "http://localhost:4321";
		const ENDPOINT_URL = "/dataset/" + id + "/" + kind;
		const ZIP_FILE_DATA = missingRoomTable;

		try {
			return request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(ZIP_FILE_DATA)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					// some logging here please!
					expect(res.status).to.be.equal(StatusCodes.BAD_REQUEST);
					expect(res.body.error).to.be.a("string");
				})
				.catch(function () {
					// some logging here please!
					expect.fail();
				});
		} catch (err) {
			Log.error(err);
			// and some more logging here!
		}
	});

	it("PUT and DELETE test for one valid course dataset", function () {
		const id = "david";
		const kind = "sections";

		const SERVER_URL = "http://localhost:4321";
		const ENDPOINT_URL = "/dataset/" + id + "/" + kind;
		const ZIP_FILE_DATA = oneCourse;

		const ENDPOINT_URL_DELETE = "/dataset/" + id;

		try {
			return request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(ZIP_FILE_DATA)
				.set("Content-Type", "application/x-zip-compressed")
				.then(async () => {
					// some logging here please!

					return request(SERVER_URL)
						.delete(ENDPOINT_URL_DELETE)
						.then(function (res: Response) {
							// some logging here please!
							expect(res.status).to.be.equal(StatusCodes.OK);
							expect(res.body.result).to.equal(id);
						})
						.catch(function () {
							// some logging here please!
							expect.fail();
						});
				})
				.catch(function () {
					// some logging here please!
					expect.fail();
				});
		} catch (err) {
			Log.error(err);
			// and some more logging here!
		}
	});

	it("FAIL to DELETE test for non existing id", function () {
		const id = "delete";

		const SERVER_URL = "http://localhost:4321";
		const ENDPOINT_URL_DELETE = "/dataset/" + id;

		try {
			return request(SERVER_URL)
				.delete(ENDPOINT_URL_DELETE)
				.then(function (res: Response) {
					// some logging here please!
					expect(res.status).to.be.equal(StatusCodes.NOT_FOUND);
					expect(res.body.error).to.be.a("string");
				})
				.catch(function () {
					// some logging here please!
					expect.fail();
				});
		} catch (err) {
			Log.error(err);
			// and some more logging here!
		}
	});

	it("FAIL to DELETE test for invalid id", function () {
		const id = "invalid_id";

		const SERVER_URL = "http://localhost:4321";
		const ENDPOINT_URL_DELETE = "/dataset/" + id;

		try {
			return request(SERVER_URL)
				.delete(ENDPOINT_URL_DELETE)
				.then(function (res: Response) {
					// some logging here please!
					expect(res.status).to.be.equal(StatusCodes.BAD_REQUEST);
				})
				.catch(function () {
					// some logging here please!
					expect.fail();
				});
		} catch (err) {
			Log.error(err);
			// and some more logging here!
		}
	});

	// it("GET test for one valid course dataset", function () {
	// 	const id = "david";
	// 	const kind = "sections";

	// 	const SERVER_URL = "http://localhost:4321";
	// 	const ENDPOINT_URL = "/dataset/" + id + "/" + kind;
	// 	const ZIP_FILE_DATA = oneCourse;

	// 	const ENDPOINT_URL_GET = "/datasets";

	// 	try {
	// 		return request(SERVER_URL)
	// 			.put(ENDPOINT_URL)
	// 			.send(ZIP_FILE_DATA)
	// 			.set("Content-Type", "application/x-zip-compressed")
	// 			.then(async function (res: Response) {
	// 				// some logging here please!
	// 				expect(res.status).to.be.equal(StatusCodes.OK);
	// 				expect(res.body.result).to.have.members([id]);

	// 				return request(SERVER_URL)
	// 					.get(ENDPOINT_URL_GET)
	// 					.then(function (res: Response) {
	// 						// some logging here please!
	// 						console.log(res.body.result);
	// 						expect(res.status).to.be.equal(StatusCodes.OK);
	// 						expect(res.body.result).to.deep.equal([{ id: "david", kind: "sections", numRows: 2 }]);
	// 					})
	// 					.catch(function () {
	// 						// some logging here please!
	// 						expect.fail();
	// 					});
	// 			})
	// 			.catch(function () {
	// 				// some logging here please!
	// 				expect.fail();
	// 			});
	// 	} catch (err) {
	// 		Log.error(err);
	// 		// and some more logging here!
	// 	}
	// });

	it("POST test for valid query", function () {
		const id = "sections";
		const kind = "sections";

		const SERVER_URL = "http://localhost:4321";
		const ENDPOINT_URL = "/dataset/" + id + "/" + kind;
		const ZIP_FILE_DATA = pair;

		const query = JSON.parse(Buffer.from(simpleQuery).toString());
		const expected = JSON.parse(Buffer.from(simpleQueryResult).toString());

		const ENDPOINT_URL_QUERY = "/query";

		try {
			return request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(ZIP_FILE_DATA)
				.set("Content-Type", "application/x-zip-compressed")
				.then(async () => {
					// some logging here please!

					return request(SERVER_URL)
						.post(ENDPOINT_URL_QUERY)
						.type("json")
						.send(query)
						.then(function (res: Response) {
							// some logging here please!
							expect(res.status).to.be.equal(StatusCodes.OK);
							expect(res.body.result).to.deep.members(expected);
						})
						.catch(function () {
							// some logging here please!
							expect.fail();
						});
				})
				.catch(function () {
					// some logging here please!
					expect.fail();
				});
		} catch (err) {
			Log.error(err);
			// and some more logging here!
		}
	});

	// The other endpoints work similarly. You should be able to find all instructions in the supertest documentation
});
