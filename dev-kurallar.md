# ⚙️ Kurallarım - Standartlar & Best Practices

## Genel Prensipleri

### Code Quality
✅ **Readability First** - "Code is read 10x more than written"  
✅ **DRY Principle** - Don't Repeat Yourself  
✅ **SOLID Principles** - Especially for larger systems  
✅ **KISS** - Keep It Simple, Stupid  
✅ **Performance** - Optimize when needed, not prematurely  
✅ **Security** - Input validation, authentication, data protection  

---

## Frontend (React) Standartları

### Yapı & Organizasyon
```
src/
├── components/
│   ├── common/
│   │   ├── Header.jsx
│   │   └── Footer.jsx
│   ├── features/
│   │   ├── Auth/
│   │   │   ├── LoginForm.jsx
│   │   │   └── SignupForm.jsx
│   │   └── Dashboard/
│   │       └── Dashboard.jsx
│   └── layouts/
├── pages/
│   ├── Home.jsx
│   ├── Profile.jsx
│   └── NotFound.jsx
├── hooks/
│   ├── useAuth.js
│   └── useFetch.js
├── services/
│   ├── api.js
│   └── auth.js
├── store/ (Redux/Context)
│   ├── slices/
│   ├── selectors.js
│   └── store.js
├── utils/
│   ├── validators.js
│   ├── formatters.js
│   └── helpers.js
├── styles/
│   ├── global.css
│   └── variables.css
├── constants/
│   └── config.js
└── App.jsx
```

### React Component Guidelines
```jsx
// ✅ Functional components with hooks
// ✅ Proper naming: PascalCase for components
// ✅ PropTypes or TypeScript
// ✅ Custom hooks for reusable logic
// ✅ useCallback for optimization when needed
// ✅ Proper error boundaries
// ✅ Accessible HTML (ARIA labels, semantic HTML)

// Component template
export const ComponentName = ({ prop1, prop2 }) => {
  const [state, setState] = useState(initialState);
  
  useEffect(() => {
    // Setup
    return () => {
      // Cleanup
    };
  }, [dependencies]);

  const handleAction = useCallback(() => {
    // Action logic
  }, [dependencies]);

  return (
    <div className="component">
      {/* JSX */}
    </div>
  );
};

ComponentName.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.number,
};

export default ComponentName;
```

### CSS/Styling
✅ **BEM naming** - Block Element Modifier  
✅ **CSS Modules** - Component-scoped styling  
✅ **Tailwind CSS** - Or utility-first approach  
✅ **Responsive Design** - Mobile-first  
✅ **Consistent spacing** - Use design system tokens  

### API Integration
```javascript
// ✅ Centralized API client
// ✅ Error handling
// ✅ Timeout handling
// ✅ Request/response interceptors
// ✅ Proper HTTP status handling

// Example: services/api.js
import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  timeout: 10000,
});

API.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  response => response.data,
  error => Promise.reject(error)
);

export default API;
```

---

## Backend (Python) Standartları

### Yapı & Organizasyon
```
project/
├── app/
│   ├── __init__.py
│   ├── main.py (entry point)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── product.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   └── products.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   └── product_service.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── requests.py
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── validators.py
│   │   └── helpers.py
│   └── middleware/
│       ├── __init__.py
│       └── auth.py
├── migrations/ (Alembic)
├── tests/
│   ├── __init__.py
│   ├── test_auth.py
│   └── test_products.py
├── config.py
├── requirements.txt
├── .env.example
└── README.md
```

### Code Style
✅ **PEP 8** - Black formatter  
✅ **Type Hints** - All functions  
✅ **Docstrings** - Google style  
✅ **Error Handling** - Custom exceptions  
✅ **Logging** - Structured logging  

### Python Example
```python
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session
from schemas import UserCreate, UserResponse
from models import User
from services import UserService

router = APIRouter(prefix="/users", tags=["users"])

@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_user(
    user_data: UserCreate,
    db: Session
) -> UserResponse:
    """
    Create a new user.
    
    Args:
        user_data: User creation data
        db: Database session
        
    Returns:
        UserResponse: Created user data
        
    Raises:
        HTTPException: If user already exists
    """
    try:
        user = await UserService.create_user(db, user_data)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: Session) -> UserResponse:
    """Retrieve a user by ID."""
    user = await UserService.get_user(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user
```

### API Design
✅ **RESTful** - Proper HTTP methods, status codes  
✅ **Versioning** - /api/v1/ prefix  
✅ **Pagination** - Limit, offset patterns  
✅ **Filtering** - Query parameters  
✅ **Validation** - Request schemas  
✅ **Documentation** - OpenAPI/Swagger  

---

## Database Standartları

### Schema Design
✅ **Normalization** - 3NF minimum  
✅ **Naming Conventions** - snake_case  
✅ **Primary Keys** - Always have one  
✅ **Foreign Keys** - Proper relationships  
✅ **Indexes** - On frequently queried columns  
✅ **Constraints** - NOT NULL, UNIQUE, CHECK  

### Example Migration
```sql
-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username)
);

-- Create products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_name (name)
);
```

### Query Optimization
✅ **Use EXPLAIN** - Analyze query plans  
✅ **Avoid SELECT \*** - Select specific columns  
✅ **Use JOINs** - Not multiple queries  
✅ **Proper Indexes** - But not too many  
✅ **Connection Pooling** - Reuse connections  

---

## Mobile Development Standartları

### Architecture
✅ **MVC/MVVM** - Clear separation  
✅ **State Management** - Redux, Provider pattern  
✅ **Responsive Design** - Multiple screen sizes  
✅ **Navigation** - Proper navigation stack  
✅ **Error Handling** - User-friendly error messages  
✅ **Offline First** - Work without connectivity  

### Performance
✅ **Image Optimization** - Proper sizing, caching  
✅ **Lazy Loading** - Lists, images  
✅ **Code Splitting** - Feature-based bundles  
✅ **Minimal Dependencies** - Keep app size small  
✅ **Memory Management** - Avoid leaks  

---

## DevOps & Infrastructure Standartları

### Docker
```dockerfile
# ✅ Multi-stage builds
# ✅ Minimal base images (alpine)
# ✅ Layer caching
# ✅ Non-root user
# ✅ Health checks

FROM python:3.11-alpine AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-alpine
WORKDIR /app
RUN adduser -D appuser

COPY --from=builder /usr/local/lib /usr/local/lib
COPY app/ .

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "main:app"]
```

### Deployment
✅ **CI/CD Pipeline** - Automated testing & deployment  
✅ **Environment Management** - dev, staging, production  
✅ **Secrets Management** - Environment variables, vaults  
✅ **Monitoring** - Logs, metrics, alerts  
✅ **Backup Strategy** - Regular backups  
✅ **SSL/TLS** - HTTPS everywhere  

### Security
✅ **Input Validation** - All user inputs  
✅ **SQL Injection Prevention** - Use ORM/parameterized queries  
✅ **CORS Configuration** - Proper CORS headers  
✅ **Rate Limiting** - Prevent abuse  
✅ **JWT/OAuth** - Secure authentication  
✅ **OWASP Top 10** - Follow guidelines  

---

## Testing Standartları

### Unit Tests
```python
# pytest with fixtures
def test_user_creation(db):
    """Test creating a new user."""
    user = UserService.create_user(
        db,
        UserCreate(email="test@example.com", password="secure")
    )
    assert user.email == "test@example.com"
    assert db.query(User).count() == 1
```

✅ **Coverage** - Aim for 70%+ coverage  
✅ **Edge Cases** - Test boundary conditions  
✅ **Mocking** - External dependencies  
✅ **Clear Names** - test_[feature]_[scenario]  

### Integration Tests
✅ **API Endpoints** - Full request/response cycle  
✅ **Database** - Real database with transactions  
✅ **Third-party Services** - Mocked appropriately  

### End-to-End Tests
✅ **User Workflows** - Complete user journeys  
✅ **Real Environment** - Staging/production-like  

---

## Version Control & Collaboration

### Git Workflow
```
main (production-ready)
├── develop (integration branch)
│   └── feature/user-auth (feature branches)
│       └── fix/auth-bug (bug fixes)
└── release/v1.0.0 (release candidates)
```

✅ **Descriptive Commits** - "Add user authentication" not "fix"  
✅ **Branch Protection** - Require code review  
✅ **Pull Requests** - Proper descriptions, linked issues  
✅ **Code Review** - Before merging to main  

### Commit Message Format
```
type(scope): subject

body

footer
```

**Types**: feat, fix, docs, style, refactor, test, chore

---

## Ne Yapmıyorum?

❌ Sloppy code structure  
❌ Missing error handling  
❌ No tests  
❌ Security oversights  
❌ Production-ready olmayan code  
❌ Hacky solutions  
❌ Documentation without code  

## Başarı Kriterleri

✅ Kod çalışıyor  
✅ Kod clean & maintainable  
✅ Tests pass  
✅ Performance acceptable  
✅ Security checked  
✅ Properly documented  
✅ Ready to handoff  
