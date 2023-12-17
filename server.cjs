const express = require('express')
const bodyparser = require('body-parser')
const bcrypt = require('bcrypt-nodejs')
const cors = require('cors')
const knex = require('knex')

const app = express()
app.use(bodyparser.json())
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

app.get('/', (res) => {
    res.json('it is working!')
})

app.post('/signin', (req, res) => {
    const {email, password} = req.body
    if(!email || !password) {
        res.status(400).json('incorrect form submission')
    }
    db.select('email', 'hash').from('login')
    .where('email', '=', email)
    .then(data => {
        const isValid = bcrypt.compareSync(password, data[0].hash)
        if(isValid) {
            return db.select('*').from('users')
            .where('email', '=', email)
            .then(user => {
                res.json(user[0])
                // console.log(user[0].event_dates[0].slice(0,15));
                // console.log(user[0].event_dates[0].slice(17,32));
                // console.log(user[0].event_dates[0].length);
            })
            .catch(err => res.status(400).json('unable to get user'))
        } else {
            res.status(400).json('wrong cridentials')
        }        
    })
    .catch(err =>  res.status(400).json('wrong cridentials'))
})

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

    db.select('*').from('users').where({email: email})    
    .returning('*')
    .then(data => {
        db.select('*').from('users').where({email: email})
        .update({
            event_name: [...data[0].event_name, name],
            event_details: [...data[0].event_details, details],
            event_dates: [...data[0].event_dates, dates],
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

app.listen(3000, () => {
    console.log('app is running')
})