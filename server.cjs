require('dotenv').config()

const express = require('express')
const bodyparser = require('body-parser')
const bcrypt = require('bcrypt-nodejs')
const cors = require('cors')
const knex = require('knex')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')

const users = [
    {username: 'r'},
    {username: 'p'}
]

const access = process.env.ACCESS_TOKEN_SECRET
const refresh = process.env.REFRESH_TOKEN_SECRET

// const fsPromises = require('fs').promises

const app = express()
app.use(bodyparser.json())
app.use(cookieParser())
app.use(cors())

const db = knex({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    user: 'postgres',
    password: 'Wiggles123',
    database: 'calendar'
  }
});


const verifyJWT = (req, res, next) => {
        const authHeader = req.headers['authorization']
        if(!authHeader) return res.sendStatus(400)
        const token = authHeader?.split(' ')[1]
        jwt.verify(
            token,
            access,
            (err, user) => {
                if(err) return res.status(403).json('bad token')
                req.user = user
                next()
            }
        ) 
    }

const generateAccess = (user) => jwt.sign(user, access, {expiresIn: '5m'})


app.get('/', (res) => {
    res.json('it is working!')
})

app.post('/token', (req, res) => {
    const refreshToken = req.body.token
    db.select('*').from('login').where({refresh: refreshToken})
    .then(data => {
        jwt.verify(data[0].refresh, refresh, (err, user) => {
            if (err) return res.status(403).json('bad token')
            const accessToken = generateAccess({email: user.email})
            res.json(accessToken)
        })
    })
    .catch(err => res.status(403).json('refreshToken is incorrect'))
})

app.get('/post', verifyJWT, (req, res) => {
    db.select('*').from('users')
    .then(data => {
        res.json(data.filter(user => user.email === req.user.email))
    })
})

app.post('/log', (req, res) => {
    const {email, password} = req.body
    if(!email || !password) {
        res.status(400).json('incorrect form submission')    }
    
    db.select('email', 'hash').from('login')
        .where('email', '=', email)
        .then(data => {
            const isValid = bcrypt.compareSync(password, data[0].hash)
            if(isValid) {
                return db.select('*').from('users')
                .where('email', '=', email)
                .then(data => {
                    const email = data[0].email
                    const user = {email: email}
                    const accessToken = generateAccess(user)
                    const refreshToken = jwt.sign(user, refresh, {expiresIn: '6h'})
                    db.select('*').from('login').where({email: email})
                    .update({refresh: refreshToken}).returning('*')
                    .then(data => {
                        res.json({accessToken: accessToken, refreshToken: data[0].refresh})
                    })
                })
                .catch(err => res.status(400).json('unable to get user'))
            } else {
                res.status(400).json('wrong cridentials')
            }        
        })
        .catch(err =>  res.status(400).json('wrong cridentials'))
})

app.post('/logout', (req, res) => {
    const {email} = req.body
    db('login').where({email: email})
    .update({refresh: null})
    .returning('*')
    .then(data => res.json(data))
})

// app.post('/signin', (req, res) => {
//     const {email, password} = req.body
//     if(!email || !password) {
//         res.status(400).json('incorrect form submission')    
//     }

//     db.select('email', 'hash').from('login')
//     .where('email', '=', email)
//     .then(data => {
//         const isValid = bcrypt.compareSync(password, data[0].hash)
//         if(isValid) {
//             return db.select('*').from('users')
//             .where('email', '=', email)
//             .then(user => {
//                 res.json(user[0])
//             })
//             .catch(err => res.status(400).json('unable to get user'))
//         } else {
//             res.status(400).json('wrong cridentials')
//         }        
//     })
//     .catch(err =>  res.status(400).json('wrong cridentials'))
// })

app.post('/register', (req, res) => {
    const {firstName, lastName, email, password} = req.body
    if(!email || !firstName || !lastName || !password) {
        res.status(400).json('incorrect form submission')
    }
    const hash = bcrypt.hashSync(password)
    db.transaction(trx => {
        trx.insert({
            hash: hash,
            email: email
        })
        .into('login')
        .returning('email')
        .then(loginEmail => {
            return trx('users')
                .returning('*')
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
                    event_sat: []                   
                })
                .then(user => {
                    res.json(user[0])
                })
        })
        .then(trx.commit)
        .catch(trx.rollback)
    })
    .catch(err => res.status(400).json('unable to register'))
})

app.put('/add', (req, res) => {
    const {email, name, details, dates, time, period, Sun, Mon, Tue, Wed, Thu, Fri, Sat} = req.body
    const joined = dates.join(', ')

    db.select('*').from('users').where({email: email})    
    .returning('*')
    .then(data => {
        db.select('*').from('users').where({email: email})
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
            event_sat: [...data[0].event_sat, Sat]
        })
        .returning('*')
        .then(data => res.json(data[0]))
    })
})

app.post('/edit', (req, res) => {
    const {email, oldName, newName, details, dates, time, period, Sun, Mon, Tue, Wed, Thu, Fri, Sat} = req.body

    db.select('*').from('users').where({email: email})    
    .returning('*')
    .then(data => {
        let index = data[0].event_name.indexOf(oldName)
        let currentName = data[0].event_name
        let currentDetails = data[0].event_details
        let currentDates = data[0].event_dates
        let currentTime = data[0].event_time
        let currentPeriod = data[0].event_period
        let currentSun = data[0].event_sun
        let currentMon = data[0].event_mon
        let currentTue = data[0].event_tue
        let currentWed = data[0].event_wed
        let currentThu = data[0].event_thu
        let currentFri = data[0].event_fri
        let currentSat = data[0].event_sat

        currentName[index] = newName
        currentDetails[index] = details
        currentDates[index] = dates.join(', ')
        currentTime[index] = time
        currentPeriod[index] = period
        currentSun[index] = Sun
        currentMon[index] = Mon
        currentTue[index] = Tue
        currentWed[index] = Wed
        currentThu[index] = Thu
        currentFri[index] = Fri
        currentSat[index] = Sat

         db.select('*').from('users').where({email: email})
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
            event_sat: currentSat
        })
        .returning('*')
        .then(data => res.json(data[0]))
    })
})

app.listen(4000, () => {
    console.log('app is running')
})