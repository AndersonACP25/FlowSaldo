import assert from 'node:assert/strict';
export async function checkCategories(request) {
  const get = async (path) => {
    const res = await request(path);
    assert.equal(res.status, 200);
    return res.json();
  };
  const send = (path, method, body) => request(path, { method, body: JSON.stringify(body) });
  const name = `Hogar sintético ${Date.now()}`;
  assert.equal((await send('/categories', 'POST', { name: '  ' })).status, 400);
  const create = await send('/categories', 'POST', { name });
  assert.equal(create.status, 201);
  const c = await create.json();
  assert.equal(
    (await send('/categories', 'POST', { name: '  ' + name.toUpperCase() + '  ' })).status,
    409,
  );
  const draft = {
    amountMinor: 10001,
    currency: 'DOP',
    type: 'EXPENSE',
    description: 'Categoría histórica',
    categoryId: c.id,
    category: name,
    occurredAt: '2042-04-01T00:00:00.000Z',
  };
  const response = await send('/movements', 'POST', draft);
  assert.equal(response.status, 201);
  const movement = await response.json();
  assert.equal((await send('/categories/' + c.id, 'PATCH', { name: name + ' nuevo' })).status, 200);
  const filtered = await get(`/movements?page=true&month=2042-04&currency=DOP&categoryId=${c.id}`);
  assert.equal(filtered.total, 1);
  assert.equal(filtered.items[0].category, name);
  assert.equal(
    (await get('/summary?month=2042-04&currency=DOP')).categoryTotals.find(
      (v) => v.categoryId === c.id,
    ).amountMinor,
    10001,
  );
  const csv = await request(`/movements/export?month=2042-04&currency=DOP&categoryId=${c.id}`);
  assert.match(await csv.text(), new RegExp(name));
  assert.equal((await send('/categories/' + c.id, 'PATCH', { archived: true })).status, 200);
  assert.equal((await send('/movements', 'POST', draft)).status, 409);
  assert.equal(
    (
      await send('/movements/' + movement.id, 'PATCH', {
        ...draft,
        description: 'Editado conservando categoría',
      })
    ).status,
    200,
  );
  const item = (await get('/categories')).find((v) => v.id === c.id);
  assert.equal(item.archived, true);
  const uncategorized = (await get('/categories')).find((v) => v.system);
  assert.equal(
    (await send('/categories/' + uncategorized.id, 'PATCH', { archived: true })).status,
    409,
  );
  assert.equal(
    (await send('/categories/' + uncategorized.id, 'PATCH', { name: 'Otro' })).status,
    409,
  );
  assert.equal(
    (await request('/categories/' + uncategorized.id, { method: 'DELETE' })).status,
    409,
  );
  assert.equal((await request('/categories/' + c.id, { method: 'DELETE' })).status, 409);
  assert.equal((await send('/categories/' + c.id, 'PATCH', { archived: false })).status, 200);
  const another = await send('/movements', 'POST', draft);
  assert.equal(another.status, 201);
  const anotherMovement = await another.json();
  assert.equal(anotherMovement.category, name + ' nuevo');
  // Archived categories cannot be assigned while confirming a review, either.
  await send('/imports', 'POST', { externalId: name, body: 'Aviso sin formato' });
  let review;
  for (let i = 0; i < 40; i++) {
    review = (await get('/imports?page=true&status=REVIEW&limit=200')).items.find(
      (v) => v.externalId === name,
    );
    if (review) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(review);
  await send('/categories/' + c.id, 'PATCH', { archived: true });
  assert.equal((await send('/imports/' + review.id + '/resolve', 'POST', draft)).status, 409);
  assert.equal((await get('/imports/' + review.id)).status, 'REVIEW');
  await send('/imports/' + review.id + '/dismiss', 'POST', {});
  assert.equal((await request('/movements/' + movement.id, { method: 'DELETE' })).status, 204);
  assert.equal(
    (await request('/movements/' + anotherMovement.id, { method: 'DELETE' })).status,
    204,
  );
  assert.equal((await request('/categories/' + c.id, { method: 'DELETE' })).status, 204);
  assert.equal((await request('/categories/' + c.id, { method: 'DELETE' })).status, 404);
  assert.ok(!(await get('/categories')).some((item) => item.id === c.id));
  console.info(
    'PASS: category CRUD, duplicate normalization, snapshot rename, ID filter/CSV/totals, archived assignments/review, preserved edits, system category',
  );
}
