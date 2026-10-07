import mqtt from 'mqtt'

/**
 * Publishes a single message to an MQTT broker and disconnects.
 * Uses MQTT_BROKER_URL from env (e.g. mqtt://broker.local:1883 or mqtts://broker:8883).
 * Rejects if MQTT_BROKER_URL is not set or the publish fails.
 */
export function publishMqtt(topic: string, payload: string): Promise<void> {
  const brokerUrl = process.env.MQTT_BROKER_URL
  if (!brokerUrl) return Promise.reject(new Error('MQTT_BROKER_URL no configurado en .env'))

  return new Promise((resolve, reject) => {
    const client = mqtt.connect(brokerUrl, { connectTimeout: 10_000 })
    const guard = setTimeout(() => {
      client.end(true)
      reject(new Error('MQTT: timeout al conectar'))
    }, 12_000)

    client.on('connect', () => {
      client.publish(topic, payload, { qos: 1, retain: false }, (err) => {
        clearTimeout(guard)
        client.end()
        err ? reject(err) : resolve()
      })
    })

    client.on('error', (err) => {
      clearTimeout(guard)
      client.end(true)
      reject(err)
    })
  })
}
