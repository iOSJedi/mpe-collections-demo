export async function invokeLambda(payload: Record<string, unknown>) {
  const url = process.env.LAMBDA_URL
  if (!url) {
    throw new Error('LAMBDA_URL is not configured')
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.LAMBDA_API_KEY && {
        'x-api-key': process.env.LAMBDA_API_KEY,
      }),
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Lambda invocation failed: ${response.status}`)
  }

  return response.json()
}
