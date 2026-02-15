import express from 'express'
import axios from 'axios'

const app = express()
app.use(express.json())

// internal urls
const GAMEY_URL = 'http://localhost:4000'
const USERS_URL = 'http://localhost:3000'

//GAMEY ENDPOINTS

// NEW GAME
app.post('/game/new', async (req, res) => {
  try {
    const { size } = req.body

    const response = await axios.post(`${GAMEY_URL}/game/new`, { size })

    return res.status(200).json({
      ok: true,
      yen: response.data
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Game server unavailable'
    })
  }
})

// PVB MOVE
app.post('/game/pvb/move', async (req, res) => {
  const { yen, bot } = req.body

  if (!yen) {
    return res.status(400).json({
      ok: false,
      error: 'Missing YEN'
    })
  }

  try {
    const response = await axios.post(`${GAMEY_URL}/game/pvb/move`, {
      yen,
      bot
    })

    return res.status(200).json({
      ok: true,
      yen: response.data
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Game server unavailable'
    })
  }
})

// BOT CHOOSE
app.post('/game/bot/choose', async (req, res) => {
  const { yen, bot } = req.body

  if (!yen) {
    return res.status(400).json({
      ok: false,
      error: 'Missing YEN'
    })
  }

  try {
    const response = await axios.post(`${GAMEY_URL}/game/bot/choose`, {
      yen,
      bot
    })

    return res.status(200).json({
      ok: true,
      coordinates: response.data.coords
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Game server unavailable'
    })
  }
})

// USERS ENDPOINTS

app.post('/createuser', async (req, res) => {
  try {
    const response = await axios.post(`${USERS_URL}/createuser`, req.body)

    return res.status(200).json(response.data)
  } catch (error) {
    return res.status(500).json({
      error: 'User service unavailable'
    })
  }
})

export default app
