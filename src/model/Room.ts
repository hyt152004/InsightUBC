export default class Room {
	private fullname: string;
	private shortname: string;
	private number: string; // room number. not always a number so represented as a string
	private name: string;
	private address: string;
	private lat: number;
	private lon: number;
	private seats: number;
	private type: string;
	private furniture: string;
	private href: string;

	constructor(data: any) {
		this.fullname = data.fullname;
		this.shortname = data.shortname;
		this.number = data.number;
		this.name = data.name;
		this.address = data.address;
		this.lat = data.lat;
		this.lon = data.lon;
		this.seats = data.seats;
		this.type = data.type;
		this.furniture = data.furniture;
		this.href = data.href;
	}

	public getPrefixedFields(id: string): Record<string, any> {
		const prefix = id + "_";
		return {
			[prefix + "fullname"]: this.fullname,
			[prefix + "shortname"]: this.shortname,
			[prefix + "number"]: this.number,
			[prefix + "name"]: this.name,
			[prefix + "address"]: this.address,
			[prefix + "lat"]: this.lat,
			[prefix + "lon"]: this.lon,
			[prefix + "seats"]: this.seats,
			[prefix + "type"]: this.type,
			[prefix + "furniture"]: this.furniture,
			[prefix + "href"]: this.href,
		};
	}
}
