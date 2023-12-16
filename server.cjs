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

app.get('/', (req,res) => {
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

app.listen(3000, () => {
    console.log('app is running')
})