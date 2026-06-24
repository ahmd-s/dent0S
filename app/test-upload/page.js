'use client'

import { useState } from 'react'

export default function TestUpload() {
  const [url, setUrl] = useState('')

  const upload = async (e) => {
    const file = e.target.files[0]

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/clinic/logo', {
      method: 'POST',
      body: formData
    })

    const data = await res.json()

    console.log(data)

    if (data.url) {
      setUrl(data.url)
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <input type="file" onChange={upload} />

      {url && (
        <>
          <p>{url}</p>
          <img
            src={url}
            alt=""
            style={{ width: 200, marginTop: 20 }}
          />
        </>
      )}
    </div>
  )
}