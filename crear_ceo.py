import sqlite3
import bcrypt

conn = sqlite3.connect('backend/inventario.db')
c = conn.cursor()
username = 'alecruz'
password = 'Chipactli2026!'
hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
nombre = 'Alejandro Cruz'
rol = 'ceo'
c.execute("DELETE FROM usuarios WHERE username=?", (username,))
c.execute("INSERT INTO usuarios (username, password_hash, nombre, rol, debe_cambiar_password) VALUES (?, ?, ?, ?, 1)", (username, hash, nombre, rol))
conn.commit()
print('Usuario CEO insertado')
conn.close()
