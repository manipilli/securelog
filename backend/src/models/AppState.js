import mongoose from 'mongoose'

const appStateSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  users: { type: [mongoose.Schema.Types.Mixed], default: [] },
  logs: { type: [mongoose.Schema.Types.Mixed], default: [] },
  alerts: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { versionKey: false, timestamps: true })

export default mongoose.models.AppState || mongoose.model('AppState', appStateSchema)
