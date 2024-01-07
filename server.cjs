require("dotenv").config();

const express = require("express");
const bodyparser = require("body-parser");
const bcrypt = require("bcrypt-nodejs");
const cors = require("cors");
const knex = require("knex");
const jwt = require("jsonwebtoken");

const access = process.env.ACCESS_TOKEN_SECRET;
const refresh = process.env.REFRESH_TOKEN_SECRET;

const app = express();
app.use(bodyparser.json());
app.use(cors());

const db = knex({
	client: "pg",
	connection: {
		connectionString:
			"postgres://calendar_db_uv6h_user:ffJjdQMuMRX8dezkrJ00sI93BXuUBYFK@dpg-cmd37sf109ks7394lu10-a.oregon-postgres.render.com/calendar_db_uv6h",
		ssl: { rejectUnauthorized: false },
		host: "dpg-cmd37sf109ks7394lu10-a",
		port: 5432,
		user: "calendar_db_uv6h_user",
		password: "ffJjdQMuMRX8dezkrJ00sI93BXuUBYFK",
		database: "calendar_db_uv6h",
	},
});

// const db = knex({
// 	client: "pg",
// 	connection: {
// 		host: "127.0.0.1",
// 		user: "postgres",
// 		password: "Wiggles123",
// 		database: "calendar",
// 	},
// });

const verifyJWT = (req, res, next) => {
	const authHeader = req.headers["authorization"];
	if (!authHeader) return res.sendStatus(400);
	const token = authHeader?.split(" ")[1];
	jwt.verify(token, access, (err, user) => {
		if (err) return res.status(403).json("bad token");
		req.user = user;
		next();
	});
};

const generateAccess = (user) => jwt.sign(user, access, { expiresIn: "5m" });

app.get("/", (req, res) => {
	// res.json("it is working!");
	db("users")
		.returning("*")
		.then((data) => res.json(data));
});

app.post("/token", (req, res) => {
	const refreshToken = req.body.token;
	db.select("*")
		.from("login")
		.where({ refresh: refreshToken })
		.then((data) => {
			jwt.verify(data[0].refresh, refresh, (err, user) => {
				if (err) return res.status(403).json("bad token");
				const accessToken = generateAccess({ email: user.email });
				res.json(accessToken);
			});
		})
		.catch((err) => res.status(403).json("refreshToken is incorrect"));
});

app.get("/post", verifyJWT, (req, res) => {
	db.select("*")
		.from("users")
		.then((data) => {
			res.json(data.filter((user) => user.email === req.user.email));
		});
});

app.post("/log", (req, res) => {
	const { email, password } = req.body;
	if (!email || !password) {
		res.status(400).json("incorrect form submission");
	}

	db.select("email", "hash")
		.from("login")
		.where("email", "=", email)
		.then((data) => {
			const isValid = bcrypt.compareSync(password, data[0].hash);
			if (isValid) {
				return db
					.select("*")
					.from("users")
					.where("email", "=", email)
					.then((data) => {
						const email = data[0].email;
						const user = { email: email };
						const accessToken = generateAccess(user);
						const refreshToken = jwt.sign(user, refresh, { expiresIn: "6h" });
						db.select("*")
							.from("login")
							.where({ email: email })
							.update({ refresh: refreshToken })
							.returning("*")
							.then((data) => {
								res.json({
									accessToken: accessToken,
									refreshToken: data[0].refresh,
								});
							});
					})
					.catch((err) => res.status(400).json("unable to get user"));
			} else {
				res.status(400).json("wrong cridentials");
			}
		})
		.catch((err) => res.status(400).json("wrong cridentials"));
});

app.post("/logout", (req, res) => {
	const { email } = req.body;
	db("login")
		.where({ email: email })
		.update({ refresh: null })
		.returning("*")
		.then((data) => res.json("log out seccessful"));
});

app.post("/register", (req, res) => {
	const { firstName, lastName, email, password } = req.body;
	if (!email || !firstName || !lastName || !password) {
		res.status(400).json("incorrect form submission");
	}
	db.select("*")
		.from("login")
		.then((data) => {
			data?.forEach((user) => {
				if (user.email === email)
					return res.status(400).json("email is already used");
			});
			const hash = bcrypt.hashSync(password);
			db.transaction((trx) => {
				trx
					.insert({
						hash: hash,
						email: email,
					})
					.into("login")
					.returning("email")
					.then((loginEmail) => {
						return trx("users")
							.returning("*")
							.insert({
								first_name: firstName,
								last_name: lastName,
								email: loginEmail[0].email,
								event_name: [],
								event_details: [],
								event_dates: [],
								event_time: [],
								event_period: [],
								event_sun: [],
								event_mon: [],
								event_tue: [],
								event_wed: [],
								event_thu: [],
								event_fri: [],
								event_sat: [],
							})
							.then((user) => {
								return res.json(user[0]);
							});
					})
					.then(trx.commit)
					.catch(trx.rollback);
			}).catch((err) => res.status(400).json("unable to register"));
		});
});

app.put("/add", (req, res) => {
	const {
		email,
		name,
		details,
		dates,
		time,
		period,
		Sun,
		Mon,
		Tue,
		Wed,
		Thu,
		Fri,
		Sat,
	} = req.body;
	const joined = dates.join(", ");

	db.select("*")
		.from("users")
		.where({ email: email })
		.returning("*")
		.then((data) => {
			db.select("*")
				.from("users")
				.where({ email: email })
				.update({
					event_name: [...data[0].event_name, name],
					event_details: [...data[0].event_details, details],
					event_dates: [...data[0].event_dates, joined],
					event_time: [...data[0].event_time, time],
					event_period: [...data[0].event_period, period],
					event_sun: [...data[0].event_sun, Sun],
					event_mon: [...data[0].event_mon, Mon],
					event_tue: [...data[0].event_tue, Tue],
					event_wed: [...data[0].event_wed, Wed],
					event_thu: [...data[0].event_thu, Thu],
					event_fri: [...data[0].event_fri, Fri],
					event_sat: [...data[0].event_sat, Sat],
				})
				.returning("*")
				.then((data) => res.json("addition complete"));
		});
});

app.post("/edit", (req, res) => {
	const {
		email,
		oldName,
		newName,
		details,
		dates,
		time,
		period,
		Sun,
		Mon,
		Tue,
		Wed,
		Thu,
		Fri,
		Sat,
	} = req.body;

	db.select("*")
		.from("users")
		.where({ email: email })
		.returning("*")
		.then((data) => {
			let index = data[0].event_name.indexOf(oldName);
			let currentName = data[0].event_name;
			let currentDetails = data[0].event_details;
			let currentDates = data[0].event_dates;
			let currentTime = data[0].event_time;
			let currentPeriod = data[0].event_period;
			let currentSun = data[0].event_sun;
			let currentMon = data[0].event_mon;
			let currentTue = data[0].event_tue;
			let currentWed = data[0].event_wed;
			let currentThu = data[0].event_thu;
			let currentFri = data[0].event_fri;
			let currentSat = data[0].event_sat;

			currentName[index] = newName;
			currentDetails[index] = details;
			currentDates[index] = dates.join(", ");
			currentTime[index] = time;
			currentPeriod[index] = period;
			currentSun[index] = Sun;
			currentMon[index] = Mon;
			currentTue[index] = Tue;
			currentWed[index] = Wed;
			currentThu[index] = Thu;
			currentFri[index] = Fri;
			currentSat[index] = Sat;

			db.select("*")
				.from("users")
				.where({ email: email })
				.update({
					event_name: currentName,
					event_details: currentDetails,
					event_dates: currentDates,
					event_time: currentTime,
					event_period: currentPeriod,
					event_sun: currentSun,
					event_mon: currentMon,
					event_tue: currentTue,
					event_wed: currentWed,
					event_thu: currentThu,
					event_fri: currentFri,
					event_sat: currentSat,
				})
				.returning("*")
				.then((data) => res.json("edit complete"));
		});
});

app.post("/del", (req, res) => {
	const { email, name } = req.body;

	db.select("*")
		.from("users")
		.where({ email: email })
		.returning("*")
		.then((data) => {
			let index = data[0].event_name.indexOf(name);
			let currentName = data[0].event_name;
			let currentDetails = data[0].event_details;
			let currentDates = data[0].event_dates;
			let currentTime = data[0].event_time;
			let currentPeriod = data[0].event_period;
			let currentSun = data[0].event_sun;
			let currentMon = data[0].event_mon;
			let currentTue = data[0].event_tue;
			let currentWed = data[0].event_wed;
			let currentThu = data[0].event_thu;
			let currentFri = data[0].event_fri;
			let currentSat = data[0].event_sat;

			currentName.splice(index, 1);
			currentDetails.splice(index, 1);
			currentDates.splice(index, 1);
			currentTime.splice(index, 1);
			currentPeriod.splice(index, 1);
			currentSun.splice(index, 1);
			currentMon.splice(index, 1);
			currentTue.splice(index, 1);
			currentWed.splice(index, 1);
			currentThu.splice(index, 1);
			currentFri.splice(index, 1);
			currentSat.splice(index, 1);

			db.select("*")
				.from("users")
				.where({ email: email })
				.update({
					event_name: currentName,
					event_details: currentDetails,
					event_dates: currentDates,
					event_time: currentTime,
					event_period: currentPeriod,
					event_sun: currentSun,
					event_mon: currentMon,
					event_tue: currentTue,
					event_wed: currentWed,
					event_thu: currentThu,
					event_fri: currentFri,
					event_sat: currentSat,
				})
				.returning("*")
				.then((data) => res.json("delete complete"));
		});
});

app.listen(4000, () => {
	console.log("app is running");
});

// CREATE TABLE login
// (
//     id integer PRIMARY KEY NOT NULL,
//     hash character varying(100),
//     refresh character varying(1000),
//     email text UNIQUE
// );

// CREATE TABLE users
// (
//     id integer PRIMARY KEY NOT NULL,
//     first_name text,
//     last_name text,
//     email text UNIQUE,
//     event_name text[],
//     event_details text[],
//     event_dates text[],
//     event_time text[],
//     event_period text[],
//     event_sun boolean[],
//     event_mon boolean[],
//     event_tue boolean[],
//     event_wed boolean[],
//     event_thu boolean[],
//     event_fri boolean[],
//     event_sat boolean[]
// );
