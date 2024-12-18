import express from "express";
import bodyParser from "body-parser";
import env from "dotenv";
import { createClient } from '@supabase/supabase-js';
import session from "express-session";

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
// встановлюємо статичну папку для елементів сайту (фото, стилі)
app.use(express.static("public"))
// Для підлкючення env файлу
env.config();

// Налаштування сесій для збереження логіну
app.use(session({
    secret: process.env.sesion_key, 
    resave: false,
    saveUninitialized: false
}));

// Підключення до бази даних
const supabaseUrl = process.env.PROJECT_URL;
const supabaseKey = process.env.API_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getPostbyID(id){
    const {response, error} = await supabase
        .from('posts')
        .select('*')
        .eq('post_id', id);
    // console.log(response);
}

app.get('/', (req, res) => {
    // перенаправлення на реєстрацію або вхід через наявну сесію
    const username = req.session.username;  // змінна для перевірки сесії

    if (username) {
        // якщо залогінений перекидує в блог
        return res.redirect('/blog');
    }

    // інакше просто закидує в реєстраційну форму
    res.redirect('/register');
});

// Отримуємо сторінку для логіну
app.get('/login', (req, res) => {
    res.render('authorisation.ejs', { page: 'login', message: null, success: null });
});


app.get('/new', (req, res) => {
    const username = req.session.username;  // юзера беремо з сесії
    res.render('form.ejs', { post: false, username: username, pageStatus: "createPost" });
});

// Отримуємо сторінку для реєстрації
app.get('/register', (req, res) => {
    res.render('authorisation.ejs', { page: 'register', message: null, success: null });
});

app.get('/edit/:id', async (req, res) => {
    const postIdentificator = req.params.post_id;
    const editedPost = await getPostbyID(post);

    // console.log(editedPost);
    res.redirect('form.ejs');
});

// Сторінка блогу
app.get('/blog', async (req, res) => {
    const username = req.session.username;

    if (!username) {
        return res.redirect('/login'); // перекидує на сторінку логіну якщо в поточній сесії не зайдено
    }

    try {
        // запит до БД
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (userError || !userData) {
            console.error('Error fetching user data:', userError);
            return res.redirect('/blog');
        }

        const userId = userData.id;  // ID юзера

        // вибір постів конкретно для юзера по ID
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .eq('id', userId); // фільтр по ID юзера

        if (error) {
            console.error(error); // помилка
            return res.redirect('/blog'); 
        }
        console.log(data);

        // відображення наявних постів з БД
        const posts = data.map(post => ({
            username: post.username,
            postDate: post.date,
            title: post.title,
            description: post.description,
            id: post.id,
            post_id: post.post_id
        }));

        // передаємо всі пости до основної сторінки (блог)
        res.render('blog.ejs', { username, posts });

    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).send('Unexpected error');
    }
});


app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.redirect('/blog');
        }

        res.redirect('/login');
    });
});

app.post('/delete', async(req, res) => {
    const deletedOjectID = req.body.deleteItemId;

    try{
        const {response, error} = await supabase
        .from('posts')
        .delete()
        .eq('post_id', deletedOjectID)
        res.redirect('/blog');}
    catch(error){
        console.log(error);
    }
})

// авторизація та реєстрація
app.post('/login', async (req, res) => {
    const emailInput = req.body.email;
    const passwordInput = req.body.password;

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('email, password, username')
            .eq('email', emailInput)
            .single();

        if (!user) {
            return res.render('authorisation.ejs', {
                page: 'login',
                message: 'User with this email does not exist.',
                success: false,
            });
        }

        if (user.password !== passwordInput) {
            return res.render('authorisation.ejs', {
                page: 'login',
                message: 'Invalid password. Please try again.',
                success: false,
            });
        }

        // Збереження даних у сесію
        req.session.username = user.username;

        // Перехід на сторінку блогу
        res.redirect('/blog');
    } catch (err) {
        console.error(err);
        res.render('authorisation.ejs', {
            page: 'login',
            message: 'An unexpected error occurred.',
            success: false,
        });
    }
});



app.post('/register', async (req, res) => {
    const usernameInput = req.body.username;
    const emailInput = req.body.email;
    const passwordInput = req.body.password;

    try {
        // перевірка на повторюючого юзера
        const { data: existingUser, error: usernameError } = await supabase
            .from('users')
            .select('username')
            .eq('username', usernameInput)
            .single();

        if (existingUser) {
            // якщо такий юзер вже існує
            return res.render('authorisation.ejs', {
                page: 'register',
                message: 'Username is already taken. Please choose another.',
                success: false,
            });
        }

        // Отримуємо інфу з таблиці. А потім перевіряємо чи присутня така сама ж, якщо немає тоді переходимо до наступного кроку
        const { data: existingEmail, error: emailError } = await supabase
            .from('users')
            .select('email')
            .eq('email', emailInput)
            .single();


        if (existingEmail) {
            // якщо пошта вже існує в базі даних
            return res.render('authorisation.ejs', {
                page: 'register',
                message: 'Email is already registered. Please use another.',
                success: false,
            });
        }

        // закидуємо нову інформацію у базу даних
        const { data, error } = await supabase
            .from('users')
            .insert([{ username: usernameInput, email: emailInput, password: passwordInput }]);
        // помилка пов'язана з базою даних
        if (error) {
            console.error(error);
            return res.render('authorisation.ejs', {
                page: 'register',
                message: 'Registration failed. Please try again.',
                success: false,
            });
        }

        // Успішна реєстрація + обновлення сторінки register та показ message 
        res.render('authorisation.ejs', {
            page: 'register',
            message: 'Registration successful!',
            success: true,
        });
    } catch (err) {
        console.error(err);
        res.render('authorisation.ejs', {
            page: 'register',
            message: 'An unexpected error occurred.',
            success: false,
        });
    }
});

// відправка форми
app.post('/posts', async (req, res) => {
    // Get data from the form
    const { title, description } = req.body;
    const usernameForm = req.session.username;  // юзер поточної сесії ( якщо такий є )
    const date = new Date();

    // форматування дати
    const day = date.getDate();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const fullDate = day + '.' + month + '.' + year; 

    // перевірка чи є поточна сесія
    if (!usernameForm) {
        return res.status(400).send('User is not logged in');
    }

    try {
        // запит до бази даних для пошуку по ID юзера
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('username', usernameForm)
            .single();  // для 1-го юзера

        if (userError || !userData) {
            console.error('Error fetching user data:', userError);
            return res.status(500).send('Error fetching user data');
        }

        const userId = userData.id;  // отримуємо ID юзера з бази даних

        // вставляємо новий пост до бази даних
        const { data, error } = await supabase
            .from('posts')
            .insert([
                {
                    username: usernameForm,
                    date: fullDate,
                    title: title,
                    description: description,
                    id: userId  
                }
            ]);

        if (error) {
            console.error('Error inserting post:', error.message);
            return res.status(500).send('Error inserting post');
        }

        // повернення до блогу
        res.redirect('/blog');
    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).send('Unexpected error');
    }
});

// редагування наявного посту
app.post('/edit/:id', async (req, res) => {
    const identificatorOFChosenPost= req.body.deleteItemId;
    // post_id для редагування конкретного посту
    const { data, error } = await supabase
            .from('posts')
            .select('*')
            .eq('post_id', identificatorOFChosenPost)
            .single();      
    res.render('form.ejs', {post: data, pageStatus: ''});
}); 

// Обновлення інфи наявного поста
app.post('/editCurrent/:id', async (req, res) => {
    const formInfo = req.body;

    const date = new Date();

    // форматування дати
    const day = date.getDate();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const fullDate = "updated:  " + day + '.' + month + '.' + year;

    const { data, error } = await supabase
        .from('posts')
        .update({ title: formInfo.title, description: formInfo.description, date: fullDate})
        .eq('post_id', formInfo.id)
    res.redirect('/blog');
}); 

// перевірка web status'а
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
  
